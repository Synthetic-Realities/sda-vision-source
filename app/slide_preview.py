"""Local, presentation-only PPTX rendering. Independent of analysis sampling."""
from __future__ import annotations

import base64
from contextlib import closing
import hashlib
import io
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import zipfile
import xml.etree.ElementTree as ET

from .ingest import _PDFIUM_LOCK

MAX_SLIDES = 200
MAX_PREVIEW_BYTES = 64 * 1024 * 1024
_RENDER_SLOT = threading.Semaphore(1)


class PreviewError(ValueError):
    def __init__(self, detail: str, status: int = 422):
        super().__init__(detail)
        self.status = status


def _validate(raw: bytes, filename: str) -> int:
    if Path(filename).suffix.lower() != '.pptx':
        raise PreviewError('Choose a PowerPoint (.pptx) file for the slide preview.')
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            members = archive.infolist()
            if len(members) > 20000 or sum(m.file_size for m in members) > 1024 * 1024 * 1024:
                raise PreviewError('This presentation exceeds the local preview size limit.')
            names = set(archive.namelist())
            count = sum(bool(re.fullmatch(r'ppt/slides/slide\d+\.xml', n)) for n in names)
            if 'ppt/presentation.xml' not in names or not count:
                raise PreviewError('The file does not contain a readable PowerPoint presentation.')
            if count > MAX_SLIDES:
                raise PreviewError(f'The preview supports up to {MAX_SLIDES} slides. Save a shorter copy for this session.')
            for item in members:
                if 'vbaproject' in item.filename.lower():
                    raise PreviewError('Save a macro-free .pptx copy for the slide preview.')
                if item.filename.endswith('.rels'):
                    if item.file_size > 2 * 1024 * 1024:
                        raise PreviewError('The presentation relationships exceed the preview limit.')
                    for link in ET.fromstring(archive.read(item)):
                        if link.get('TargetMode') == 'External' and not link.get('Type', '').endswith('/hyperlink'):
                            raise PreviewError('This deck links to external media. Save a copy with the media embedded for preview.')
            return count
    except (zipfile.BadZipFile, ET.ParseError, KeyError, RuntimeError) as exc:
        raise PreviewError('The PowerPoint file could not be read. Try saving it again as .pptx.') from exc


def _office() -> str:
    native = Path('/Applications/LibreOffice.app/Contents/MacOS/soffice')
    executable = str(native) if native.is_file() else shutil.which('soffice') or shutil.which('libreoffice')
    if not executable:
        raise PreviewError('Install LibreOffice on the computer running SDA Vision to preview uploaded PowerPoint slides.', 503)
    return executable


def render_slides(raw: bytes, filename: str) -> dict:
    count = _validate(raw, filename)
    executable = _office()
    if not _RENDER_SLOT.acquire(blocking=False):
        raise PreviewError('Another presentation preview is being prepared. Please try again shortly.', 409)
    try:
        with tempfile.TemporaryDirectory(prefix='sda-slides-') as folder:
            root = Path(folder)
            source = root / 'presentation.pptx'
            source.write_bytes(raw)
            try:
                result = subprocess.run([executable, '-env:UserInstallation=' + (root / 'profile').as_uri(),
                    '--headless', '--convert-to', 'pdf:impress_pdf_Export', '--outdir', str(root), str(source)],
                    stdin=subprocess.DEVNULL, capture_output=True, timeout=90, check=False)
            except subprocess.TimeoutExpired as exc:
                raise PreviewError('Slide preparation took longer than 90 seconds. Try a smaller presentation.', 504) from exc
            except OSError as exc:
                raise PreviewError('LibreOffice could not start. Check its installation on the computer running SDA Vision.', 503) from exc
            pdf = root / 'presentation.pdf'
            if result.returncode or not pdf.is_file():
                raise PreviewError('The presentation could not be rendered. Try saving a fresh .pptx copy.')
            if pdf.stat().st_size > 200 * 1024 * 1024:
                raise PreviewError('The rendered presentation exceeds the preview size limit.')
            import pypdfium2 as pdfium
            slides, total = [], 0
            with _PDFIUM_LOCK, pdfium.PdfDocument(str(pdf)) as doc:
                if len(doc) != count:
                    raise PreviewError('The renderer returned a different number of slides. Check the original presentation.')
                for i in range(count):
                    with closing(doc[i]) as page:
                        width, height = page.get_size()
                        if width <= 0 or height <= 0:
                            raise PreviewError('A slide has an unreadable page size.')
                        with closing(page.render(scale=1920 / max(width, height))) as bitmap, bitmap.to_pil() as image:
                            with image.convert('RGB') as rgb:
                                stream = io.BytesIO(); rgb.save(stream, format='JPEG', quality=90)
                                encoded = stream.getvalue(); total += len(encoded)
                                if total > MAX_PREVIEW_BYTES:
                                    raise PreviewError('The slide images exceed the preview limit. Save a shorter copy for this session.')
                                slides.append({'src': 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode('ascii'),
                                               'width': rgb.width, 'height': rgb.height})
            return {'slides': slides, 'count': count, 'input_sha256': hashlib.sha256(raw).hexdigest(),
                    'scope': 'Static slide preview; animations, transitions and embedded playback remain in the original PowerPoint.'}
    except PreviewError:
        raise
    except Exception as exc:
        raise PreviewError('The slide preview could not be prepared. Try saving a fresh .pptx copy.') from exc
    finally:
        _RENDER_SLOT.release()
