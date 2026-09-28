"""Stage directory outputs, then promote with rollback and retained backups."""
from __future__ import annotations

import os
import shutil
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def reject_symlinks(root: Path) -> None:
    if root.is_symlink() or any(p.is_symlink() for p in root.rglob("*")):
        raise ValueError(f"Symlinks are not permitted in build inputs or outputs: {root}")


def project_path(value: str | Path, root: Path) -> Path:
    path = Path(value)
    path = path if path.is_absolute() else root / path
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()) or resolved == root.resolve():
        raise ValueError("Output/source must be a subdirectory of this project.")
    if path.is_symlink():
        raise ValueError("A build target cannot be a symlink.")
    return resolved


@contextmanager
def staged_outputs(targets: list[Path], *, replace_existing: bool = False):
    """Prepare every output before touching existing ones.

    Directory promotion uses renames with rollback, not a claim of uninterrupted
    atomic multi-directory visibility. Existing outputs survive as dated backups.
    """
    if len(set(targets)) != len(targets):
        raise ValueError("Build targets must be distinct.")
    if any(a != b and a.resolve().is_relative_to(b.resolve()) for a in targets for b in targets):
        raise ValueError("Build targets must not contain one another.")
    for target in targets:
        if target.exists() and not replace_existing:
            raise FileExistsError(f"{target} exists; use --replace-existing explicitly.")
        reject_symlinks(target)
    stages, backups, locks, promoted = {}, {}, [], []
    try:
        for target in targets:
            target.parent.mkdir(parents=True, exist_ok=True)
            lock = target.with_name(f".{target.name}.build.lock")
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
            locks.append(lock)
            stages[target] = Path(tempfile.mkdtemp(prefix=f".{target.name}.staging-", dir=target.parent))
        yield stages
        for target, stage in stages.items():
            if target.exists():
                if not replace_existing:
                    raise FileExistsError(f"Output appeared while building: {target}")
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                backup = target.with_name(f"{target.name}.backup-{stamp}-{uuid4().hex[:8]}")
                target.rename(backup)
                backups[target] = backup
            stage.rename(target)
            promoted.append(target)
    except BaseException:
        for target in reversed(promoted):
            target.rename(stages[target])
        for target, backup in backups.items():
            if backup.exists():
                backup.rename(target)
        raise
    finally:
        for stage in stages.values():
            if stage.exists():
                shutil.rmtree(stage)
        for lock in locks:
            lock.unlink(missing_ok=True)
    for backup in backups.values():
        print(f"Previous output retained: {backup}")
