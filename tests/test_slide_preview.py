import io
from pathlib import Path
import subprocess
import zipfile
import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen.canvas import Canvas
from app import main, slide_preview


def deck(slides=2, extra=None):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr('ppt/presentation.xml','<presentation/>')
        for i in range(slides):z.writestr(f'ppt/slides/slide{i+1}.xml','<slide/>')
        for name,data in (extra or {}).items():z.writestr(name,data)
    return out.getvalue()


def renderer(monkeypatch,pages=2):
    monkeypatch.setattr(slide_preview,'_office',lambda:'test-office');folders=[]
    def run(args,**kwargs):
        assert kwargs['timeout']==90
        folder=Path(args[-1]).parent;folders.append(folder)
        pdf=Canvas(str(folder/'presentation.pdf'),pagesize=(960,540))
        for i in range(pages):
            pdf.drawString(30,300,f'Native text and shapes: slide {i+1}');pdf.rect(200,100,150,100);pdf.showPage()
        pdf.save();return subprocess.CompletedProcess(args,0)
    monkeypatch.setattr(slide_preview.subprocess,'run',run)
    return folders


def test_all_slides_render_and_temporary_files_clean_up(monkeypatch):
    folders=renderer(monkeypatch);raw=deck();result=slide_preview.render_slides(raw,'native-shapes.pptx')
    assert result['count']==len(result['slides'])==2
    assert all(s['src'].startswith('data:image/jpeg;base64,') and s['width']==1920 for s in result['slides'])
    assert all(not p.exists() for p in folders)
    assert slide_preview._validate(raw,'native-shapes.pptx')==2


@pytest.mark.parametrize('raw,name',[(b'not a zip','image.pptx'),(deck(),'image.png'),(deck(0),'empty.pptx'),(deck(201),'large.pptx'),(deck(extra={'ppt/vbaProject.bin':b'x'}),'macro.pptx')])
def test_invalid_inputs_do_not_start_converter(monkeypatch,raw,name):
    monkeypatch.setattr(slide_preview,'_office',lambda:pytest.fail('Invalid input reached converter'))
    with pytest.raises(slide_preview.PreviewError):slide_preview.render_slides(raw,name)


def test_external_media_is_not_fetched(monkeypatch):
    raw=deck(extra={'ppt/slides/_rels/slide1.xml.rels':'<Relationships><Relationship TargetMode="External" Type="image" Target="https://example.com/private.png"/></Relationships>'})
    with pytest.raises(slide_preview.PreviewError,match='external media'):slide_preview.render_slides(raw,'linked.pptx')


def test_partial_renderer_output_has_no_silent_missing_slides(monkeypatch):
    folders=renderer(monkeypatch,pages=1)
    with pytest.raises(slide_preview.PreviewError,match='different number'):slide_preview.render_slides(deck(),'test.pptx')
    assert all(not p.exists() for p in folders)


def test_converter_timeout_releases_slot_and_cleans_files(monkeypatch):
    monkeypatch.setattr(slide_preview,'_office',lambda:'test-office');folders=[]
    def timeout(args,**kwargs):
        folders.append(Path(args[-1]).parent);raise subprocess.TimeoutExpired(args,90)
    monkeypatch.setattr(slide_preview.subprocess,'run',timeout)
    with pytest.raises(slide_preview.PreviewError,match='90 seconds'):slide_preview.render_slides(deck(),'test.pptx')
    assert all(not p.exists() for p in folders)
    assert slide_preview._RENDER_SLOT.acquire(blocking=False)
    slide_preview._RENDER_SLOT.release()


def test_preview_route_is_separate_from_inference(monkeypatch):
    calls=[]
    monkeypatch.setattr(main,'analyse',lambda *a,**kw:pytest.fail('Preview called inference'))
    monkeypatch.setattr(slide_preview,'render_slides',lambda raw,name:calls.append((raw,name)) or {'slides':[],'count':0})
    with TestClient(main.app) as client:response=client.post('/api/preview/slides',files={'file':('test.pptx',b'original')})
    assert response.status_code==200
    assert response.headers['cache-control']=='no-store'
    assert calls==[(b'original','test.pptx')]


def test_example_preview_stays_in_example_folder(monkeypatch,tmp_path):
    monkeypatch.setattr(main,'EXAMPLES_DIR',tmp_path)
    with TestClient(main.app) as client:response=client.get('/api/examples/slides',params={'name':'../outside.pptx'})
    assert response.status_code==404


def test_conference_preview_uses_manifest_validation(monkeypatch):
    monkeypatch.setattr(main,'CONFERENCE',True)
    def disallowed(*args):
        from fastapi import HTTPException
        raise HTTPException(404,'Example is outside the reviewed manifest.')
    monkeypatch.setattr(main.conference,'example_bytes',disallowed)
    with TestClient(main.app) as client:response=client.get('/api/examples/slides',params={'name':'unlisted.pptx'})
    assert response.status_code==404


def test_missing_libreoffice_explains_installation(monkeypatch):
    monkeypatch.setattr(slide_preview.Path, 'is_file', lambda self: False)
    monkeypatch.setattr(slide_preview.shutil, 'which', lambda name: None)
    with pytest.raises(slide_preview.PreviewError, match='Install LibreOffice') as error:
        slide_preview._office()
    assert error.value.status == 503
