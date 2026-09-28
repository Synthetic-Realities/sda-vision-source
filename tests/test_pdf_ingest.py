"""Offline PDF preparation coverage; fixtures contain no research media."""
import io
from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor

import pytest
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
from app import ingest as module


def document(figures=False):
    stream = io.BytesIO()
    canvas = Canvas(stream, pagesize=(400, 400))
    red = ImageReader(Image.new('RGB', (400, 300), 'red'))
    blue = ImageReader(Image.new('RGB', (400, 300), 'blue'))
    for i in range(6):
        canvas.drawString(20, 380, f'Page {i + 1}: selectable text')
        if figures:
            canvas.drawImage(red, 0, 0, 150, 100)
            if i == 0:
                canvas.drawImage(blue, 150, 0, 150, 100)
            # Tiny logos and extreme aspect ratios stay outside figure sampling.
            canvas.drawImage(ImageReader(Image.new('RGB', (50, 50), 'green')), 0, 200, 20, 20)
            canvas.drawImage(ImageReader(Image.new('RGB', (1600, 220), 'yellow')), 0, 230, 300, 40)
        else:
            canvas.rect(40, 80, 100, 100, fill=1)
        canvas.showPage()
    canvas.save()
    return stream.getvalue()


@pytest.mark.parametrize('mode', ['auto', 'pages'])
@pytest.mark.parametrize('cap,labels', [(0, [1, 2, 3, 4, 5, 6]), (1, [1]), (4, [1, 3, 4, 6])])
def test_pages_text_sampling_and_original_preservation(monkeypatch, mode, cap, labels):
    monkeypatch.setattr(module, 'settings', replace(module.settings, pdf_mode=mode))
    raw = document()
    result = module.ingest(raw, 'fixture.pdf', max_frames=cap)
    assert result.frames_found == 6
    assert [f.label for f in result.frames] == [f'page {i}' for i in labels]
    assert all(f.media.width == 612 and f.media.height == 612 for f in result.frames)
    assert 'Page 6: selectable text' in result.text
    assert result.original.raw_bytes == raw
    assert any(module.PDF_INPUT_REVISION in note for note in result.notes)


def test_figures_deduplicate_objects_and_keep_deep_pass_labels(monkeypatch):
    monkeypatch.setattr(module, 'settings', replace(module.settings, pdf_mode='auto', min_figure_px=200))
    raw = document(figures=True)
    full = module.ingest(raw, 'figures.pdf', max_frames=0)
    first = module.ingest(raw, 'figures.pdf', max_frames=1)
    assert full.frames_found == first.frames_found == 2
    assert [f.label for f in full.frames] == ['figure p1', 'figure p1.2']
    assert first.frames[0].label == full.frames[0].label
    assert first.frames[0].media.raw_bytes == full.frames[0].media.raw_bytes


def test_figures_only_does_not_render_pages(monkeypatch):
    monkeypatch.setattr(module, 'settings', replace(module.settings, pdf_mode='figures'))
    result = module.ingest(document(), 'fixture.pdf')
    assert not result.frames and result.frames_found == 0
    assert 'No embedded figures passed the size/shape filter.' in result.notes


def test_invalid_and_password_protected_inputs_have_explicit_failure():
    result = module.ingest(b'not a PDF', 'broken.pdf')
    assert not result.frames and any('Could not open PDF' in n for n in result.notes)
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(document())))
    writer.encrypt('fixture-password')
    out = io.BytesIO(); writer.write(out)
    result = module.ingest(out.getvalue(), 'locked.pdf')
    assert not result.frames and any('password is required' in n for n in result.notes)


def test_concurrent_render_requests_are_serialised(monkeypatch):
    monkeypatch.setattr(module, 'settings', replace(module.settings, pdf_mode='pages'))
    raw = document()
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: module.ingest(raw, 'fixture.pdf', max_frames=1), range(8)))
    assert all([f.label for f in result.frames] == ['page 1'] for result in results)
    assert len({result.frames[0].media.raw_bytes for result in results}) == 1
