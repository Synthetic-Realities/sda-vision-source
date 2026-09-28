import json

from app import main


def test_examples_lists_media_and_transcripts_without_packaging_files(tmp_path, monkeypatch):
    media = ["image.PNG", "podcast.m4a", "presentation.pptx", "infographic.pdf", "clip.mov", "transcript.txt"]
    for name in media + ["manifest.json", "README.md", "CREDITS.md", ".DS_Store", "LICENSE"]:
        (tmp_path / name).write_text("fixture")
    (tmp_path / "nested.png").mkdir()
    monkeypatch.setattr(main, "EXAMPLES_DIR", tmp_path)
    monkeypatch.setattr(main, "CONFERENCE", False)

    body = json.loads(main.examples().body)
    assert [item["name"] for item in body["files"]] == sorted(media, key=str.lower)
