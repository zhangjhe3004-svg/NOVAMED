"""Generate the editable DOCX execution manual from the maintained Markdown."""
from pathlib import Path
import re
import json
import zipfile
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PREVIEW = ROOT / 'docs' / '设计预览'
SOURCE = ROOT / 'docs' / '开发文档' / 'MediCode系统优化方案.md'
OUTPUT = ROOT / 'docs' / '开发文档' / 'MediCode系统优化方案与执行手册.docx'
text = SOURCE.read_text(encoding='utf-8')
start = text.find('## 附录 A')
end = text.find('## 13 ')
if 0 <= start < end:
    appendices = text[start:end].strip()
    text = text[:start] + text[end:].rstrip() + '\n\n' + appendices + '\n'
SOURCE.write_text(text, encoding='utf-8')

doc = Document()
sec = doc.sections[0]
sec.page_width = Cm(21)
sec.page_height = Cm(29.7)
sec.top_margin = Cm(2.0)
sec.bottom_margin = Cm(1.9)
sec.left_margin = Cm(2.1)
sec.right_margin = Cm(2.0)
sec.header_distance = Cm(.9)
sec.footer_distance = Cm(.85)
sec.different_first_page_header_footer = True

def font(style, size, bold=False, color='243B53', east='Microsoft YaHei'):
    style.font.name = 'Calibri'
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor.from_string(color)
    style.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), east)

font(doc.styles['Normal'], 10.5)
normal = doc.styles['Normal'].paragraph_format
normal.space_after = Pt(7)
normal.line_spacing = 1.32
normal.widow_control = True
for name, size, color in [('Title',34,'142D53'),('Subtitle',17,'607C9E'),('Heading 1',21,'142D53'),('Heading 2',13.5,'2563EB'),('Heading 3',11.5,'24506D')]:
    font(doc.styles[name],size,name != 'Subtitle',color)
    doc.styles[name].paragraph_format.space_before = Pt(16)
    doc.styles[name].paragraph_format.space_after = Pt(10)
    doc.styles[name].paragraph_format.keep_with_next = True
doc.styles['Heading 1'].paragraph_format.page_break_before = True
for name in ['List Bullet','List Number']:
    font(doc.styles[name],10.5)
    doc.styles[name].paragraph_format.space_after=Pt(5)
    doc.styles[name].paragraph_format.line_spacing=1.3
font(doc.styles['Caption'],9,False,'71849A')
if 'Code Block' not in doc.styles:
    doc.styles.add_style('Code Block',1)
font(doc.styles['Code Block'],8.2,False,'36506D','Microsoft YaHei')
doc.styles['Code Block'].font.name='Consolas'
doc.styles['Code Block'].paragraph_format.space_after=Pt(0)
doc.styles['Code Block'].paragraph_format.line_spacing=1.08
doc.styles['Code Block'].paragraph_format.left_indent=Cm(.22)
doc.styles['Code Block'].paragraph_format.right_indent=Cm(.2)

def shade(el, color):
    props = el.get_or_add_tcPr() if el.tag == qn('w:tc') else el.get_or_add_pPr()
    shd = OxmlElement('w:shd');shd.set(qn('w:fill'),color);props.append(shd)

def field(p, code):
    run=p.add_run();begin=OxmlElement('w:fldChar');begin.set(qn('w:fldCharType'),'begin')
    instr=OxmlElement('w:instrText');instr.set(qn('xml:space'),'preserve');instr.text=code
    end=OxmlElement('w:fldChar');end.set(qn('w:fldCharType'),'end')
    run._r.extend([begin,instr,end])

header=sec.header.paragraphs[0]
header.text='MEDICODE  /  系统优化方案与执行手册'
header.style='Caption'
header.paragraph_format.space_after=Pt(3)
border=OxmlElement('w:pBdr');bottom=OxmlElement('w:bottom')
for k,v in [('val','single'),('sz','6'),('space','7'),('color','D8E5F5')]:bottom.set(qn('w:'+k),v)
border.append(bottom);header._p.get_or_add_pPr().append(border)
footer=sec.footer.paragraphs[0];footer.style='Caption';footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('实施建议 · v1.1     |     ');field(footer,'PAGE');footer.add_run(' / ');field(footer,'NUMPAGES')

doc.core_properties.title='MediCode 系统优化方案与执行手册'
doc.core_properties.subject='目录、UI、前后端、数据一致性、部署及逐项验收'
doc.core_properties.author='MediCode 项目文档'
doc.core_properties.keywords='MediCode,UI,执行手册,FastAPI,React,验收'
doc.core_properties.comments='基于 2026-09-11 代码检查，更新至 2026-09-12。原型为虚构数据。'

doc.add_paragraph('MEDICODE  /  PRODUCT & ENGINEERING',style='Subtitle')
doc.add_paragraph('系统优化方案\n与执行手册',style='Title')
doc.add_paragraph('从目录与服务到登录、诊疗和患者体验',style='Subtitle')
p=doc.add_paragraph('18 个主题章节  ·  25 个执行工单  ·  可复核验收标准')
p.paragraph_format.space_before=Pt(18);p.paragraph_format.space_after=Pt(20)
p.runs[0].font.color.rgb=RGBColor.from_string('2563EB')
meta=doc.add_table(rows=0,cols=2);meta.alignment=WD_TABLE_ALIGNMENT.CENTER
for label,value in [('版本','1.1 · 执行手册版'),('更新时间','2026 年 9 月 12 日'),('基线检查','2026 年 9 月 11 日'),('适用对象','项目维护者、设计评审者、按工单执行的开发模型'),('交付性质','实施方案 + 可交互 UI 原型；尚未改造正式业务代码')]:
    cells=meta.add_row().cells;cells[0].text=label;cells[1].text=value
    cells[0].width=Cm(3);cells[1].width=Cm(13.5)
    shade(cells[0]._tc,'EAF1FA');shade(cells[1]._tc,'F5F8FC')
    for c in cells:
        for pp in c.paragraphs:
            pp.paragraph_format.space_after=Pt(7);pp.paragraph_format.space_before=Pt(7)
            for r in pp.runs:r.font.size=Pt(10)
doc.add_paragraph('阅读方式：先阅读基线与约束，再按 T00–T24 依赖顺序实施。每个任务均需以实际代码、验证命令与结果作为完成依据。',style='Normal')
doc.add_paragraph('配套设计：员工控制台、医生工作台、员工登录、患者登录、患者首页、预约、记录与个人中心。原型人物与数据均为虚构。',style='Normal')
doc.add_paragraph('本方案将技术建议转为可检查的小任务，降低执行中的猜测；具体实现仍必须经过真实验证。',style='Caption')

doc.add_page_break()
p=doc.add_paragraph('阅读导航',style='Title')
p.paragraph_format.space_before=Pt(0)
doc.add_paragraph('点击条目可跳转到相应章节；也可使用 Word / WPS 的导航窗格。',style='Caption')
chapters=[line[3:].strip() for line in text.splitlines() if line.startswith('## ')]
bookmark_map={title:f'chapter_{i}' for i,title in enumerate(chapters,1)}
for i,title in enumerate(chapters,1):
    p=doc.add_paragraph();p.paragraph_format.space_after=Pt(7)
    hl=OxmlElement('w:hyperlink');hl.set(qn('w:anchor'),bookmark_map[title]);r=OxmlElement('w:r')
    rp=OxmlElement('w:rPr');c=OxmlElement('w:color');c.set(qn('w:val'),'2563EB');rp.append(c);r.append(rp)
    t=OxmlElement('w:t');t.text=title;r.append(t);hl.append(r);p._p.append(hl)

def add_bookmark(p,title,index):
    s=OxmlElement('w:bookmarkStart');s.set(qn('w:id'),str(index));s.set(qn('w:name'),bookmark_map[title])
    e=OxmlElement('w:bookmarkEnd');e.set(qn('w:id'),str(index));p._p.insert(0,s);p._p.append(e)

def inline(p, value):
    parts=re.split(r'(\*\*.*?\*\*|`[^`]+`)',value)
    for part in parts:
        if not part:continue
        if part.startswith('**') and part.endswith('**'):
            p.add_run(part[2:-2]).bold=True
        elif part.startswith('`') and part.endswith('`'):
            run=p.add_run(part[1:-1]);run.font.name='Consolas';run.font.size=Pt(9)
        else:p.add_run(part)

def add_table(rows):
    headers=rows[0];data=[r for r in rows[1:] if not all(re.fullmatch(r':?-+:?',s.strip()) for s in r)]
    n=len(headers);table=doc.add_table(rows=1,cols=n);table.alignment=WD_TABLE_ALIGNMENT.CENTER
    table.autofit=False
    widths=([2.2,3.8,5.4,5.4] if n==4 else [3.2,6.5,7.1] if n==3 else [4,12.8] if n==2 else [16.8/n]*n)
    if headers[0]=='编号':widths=[1.25,1.35,7.1,7.1]
    for col,w in zip(table.columns,widths):col.width=Cm(w)
    for j,h in enumerate(headers):table.rows[0].cells[j].text=h
    trpr=table.rows[0]._tr.get_or_add_trPr();repeat=OxmlElement('w:tblHeader');trpr.append(repeat)
    for row in data:
        cells=table.add_row().cells
        for j,v in enumerate(row[:n]):cells[j].text=v
    for i,row in enumerate(table.rows):
        cant=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(cant)
        for j,cell in enumerate(row.cells):
            cell.width=Cm(widths[j]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            shade(cell._tc,'19385F' if i==0 else ('F2F6FB' if i%2 else 'FFFFFF'))
            for p in cell.paragraphs:
                p.paragraph_format.space_before=Pt(6);p.paragraph_format.space_after=Pt(6)
                p.paragraph_format.line_spacing=1.22
                for r in p.runs:
                    r.font.size=Pt(9);r.font.name='Calibri'
                    r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Microsoft YaHei')
                    r.font.color.rgb=RGBColor.from_string('FFFFFF' if i==0 else '344D69')
                    r.bold=i==0
    p=doc.add_paragraph();p.paragraph_format.space_after=Pt(3);p.paragraph_format.space_before=Pt(0)

lines=text.splitlines();i=0;image_count=0;head_id=0
while i<len(lines):
    line=lines[i].strip()
    if not line or line.startswith('# ') or line.startswith('版本：'):
        i+=1;continue
    if line.startswith('```'):
        i+=1
        while i<len(lines) and not lines[i].strip().startswith('```'):
            p=doc.add_paragraph(lines[i] or ' ',style='Code Block');shade(p._p,'F2F5FA');i+=1
        doc.add_paragraph().paragraph_format.space_after=Pt(2);i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            rows.append([s.strip() for s in lines[i].strip().strip('|').split('|')]);i+=1
        add_table(rows);continue
    if line.startswith('## '):
        title=line[3:];p=doc.add_paragraph(title,style='Heading 1');head_id+=1;add_bookmark(p,title,head_id)
    elif line.startswith('### '):
        doc.add_paragraph(line[4:],style='Heading 2')
    elif line.startswith('!['):
        match=re.match(r'!\[(.*?)\]\((.*?)\)',line)
        if match:
            caption,relative=match.groups();file=(SOURCE.parent/relative).resolve()
            if not file.exists():raise FileNotFoundError(file)
            doc.add_page_break();p=doc.add_paragraph(caption,style='Heading 2')
            im=Image.open(file);w,h=im.size
            width=min(16.8,21.2*w/h)
            p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            p.add_run().add_picture(str(file),width=Cm(width))
            doc.add_paragraph(f'图 {image_count+1}  {caption}。原型实际渲染；完整分辨率图片见 docs/设计预览/。',style='Caption')
            image_count+=1
    elif line.startswith('- '):
        p=doc.add_paragraph(style='List Bullet');inline(p,line[2:])
    elif re.match(r'^\d+\. ',line):
        p=doc.add_paragraph();p.paragraph_format.left_indent=Cm(.15);inline(p,line)
    else:
        p=doc.add_paragraph();inline(p,line)
    i+=1

doc.save(OUTPUT)
check=Document(OUTPUT)
all_text='\n'.join(p.text for p in check.paragraphs)
for required in ['T00 保存基线','T24 最终回归','员工与患者登录页','关键契约与参考算法']:
    assert required in all_text,required
assert len(check.inline_shapes)==9
with zipfile.ZipFile(OUTPUT) as z:
    assert z.testzip() is None
    assert 'word/document.xml' in z.namelist()
report={'file':str(OUTPUT),'bytes':OUTPUT.stat().st_size,'source_characters':len(text),'chapters':len(chapters),'paragraphs':len(check.paragraphs),'tables':len(check.tables),'embedded_screenshots':len(check.inline_shapes),'work_orders':25,'validated':'DOCX reopened; all required chapters and tasks present; ZIP integrity checked. Office pagination was not rendered.'}
(PREVIEW/'document-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

font_path=Path('C:/Windows/Fonts/msyh.ttc')
font_title=ImageFont.truetype(str(font_path),26)
font_label=ImageFont.truetype(str(font_path),17)
canvas=Image.new('RGB',(1600,1130),'#f0f4f9');draw=ImageDraw.Draw(canvas)
draw.text((34,22),'MediCode · 登录与患者端 UI 预览',font=font_title,fill='#19385f')
draw.text((35,65),'设计原型 / 虚构演示数据 / 2026.09',font=font_label,fill='#8092ab')
cards=[('07-员工登录.png','员工登录',(30,112,785,602)),('08-患者登录.png','患者登录',(815,112,1570,602)),('09-患者端首页.png','患者端首页',(30,630,785,1120)),('10-患者预约.png','患者预约',(815,630,1570,1120))]
for filename,label,(x1,y1,x2,y2) in cards:
    draw.text((x1+4,y1),label,font=font_label,fill='#355878')
    area=(x1,y1+33,x2,y2-10)
    image=Image.open(PREVIEW/filename).convert('RGB')
    thumb=ImageOps.contain(image,(area[2]-area[0],area[3]-area[1]))
    draw.rounded_rectangle(area,radius=10,fill='white',outline='#dbe5f1')
    canvas.paste(thumb,(area[0]+(area[2]-area[0]-thumb.width)//2,area[1]+(area[3]-area[1]-thumb.height)//2))
canvas.save(PREVIEW/'00-UI设计总览.png')
