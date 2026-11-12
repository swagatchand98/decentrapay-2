#!/usr/bin/env python3
"""Build the offline presentation pack from text, editable geometry, and real evidence.

No private keys, fingerprint templates, or invented hardware results are included.
The report DOCX is standard OOXML; PDFs are rendered independently from shared content.
"""
import json
import os
import re
import zipfile
from pathlib import Path
from html import escape
from xml.sax.saxutils import escape as xml_escape
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
ASSETS = OUT / 'assets'
FONT = Path(os.environ.get('DEJAVU_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
for name, file in [('DV', 'DejaVuSans.ttf'), ('DV-Bold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT / file)))
ASSETS.mkdir(exist_ok=True)
GREEN = '173F35'
MUTED = '65786B'
CREAM = 'F6F7F2'
PALE = 'E8EEDC'
LIME = 'D2E8A2'
WHITE = 'FFFFFF'
AMBER = '976126'
snapshot = json.loads((OUT / 'evidence/demo-snapshot.json').read_text())
report = json.loads((HERE / 'report.json').read_text())


def color(hexcode):
    return colors.HexColor('#' + hexcode)


def para(text, size=10.5, bold=False, ink=GREEN, leading=None, align=0):
    style = ParagraphStyle('p', fontName='DV-Bold' if bold else 'DV', fontSize=size,
                           leading=leading or size * 1.43, textColor=color(ink), alignment=align,
                           splitLongWords=True, spaceAfter=0)
    return Paragraph(escape(text).replace('\n', '<br/>'), style)


def architecture():
    """Original diagram, not a hardware photograph."""
    im = Image.new('RGB', (1600, 710), '#' + CREAM)
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(FONT / 'DejaVuSans.ttf'), 25)
    bold = ImageFont.truetype(str(FONT / 'DejaVuSans-Bold.ttf'), 29)
    small = ImageFont.truetype(str(FONT / 'DejaVuSans.ttf'), 22)
    d.rounded_rectangle((35, 40, 1060, 630), radius=20, fill='#E8EEDC')
    d.text((60, 60), 'LAPTOP • LOCAL DEMONSTRATION', fill='#65786B', font=small)
    nodes = [(75, 165, 440, 340, 'Browser + MetaMask', ['Wallet approval', 'ATM interface']),
             (615, 165, 1010, 340, 'Local blockchain', ['DemoATM contract', 'Payment + event']),
             (355, 440, 785, 605, 'Node.js bridge', ['Receipt verification', 'Dispensing journal']),
             (1150, 265, 1550, 470, 'ESP32 over USB', ['R307 fingerprint', 'SG90 servo + LED'])]
    for x1, y1, x2, y2, title, lines in nodes:
        d.rounded_rectangle((x1, y1, x2, y2), radius=14, fill='#173F35')
        d.text((x1 + 20, y1 + 24), title, fill='white', font=bold)
        for i, line in enumerate(lines):
            d.text((x1 + 20, y1 + 78 + 36 * i), line, fill='#D2E8A2', font=font)
    def arrow(points, label, pos):
        d.line(points, fill='#65786B', width=5)
        x, y = points[-1]
        px, py = points[-2]
        if x > px: tri = [(x, y), (x-14, y-8), (x-14, y+8)]
        elif y > py: tri = [(x, y), (x-8, y-14), (x+8, y-14)]
        else: tri = [(x, y), (x-8, y+14), (x+8, y+14)]
        d.polygon(tri, fill='#65786B')
        d.text(pos, label, fill='#173F35', font=small)
    arrow([(440, 220), (615, 220)], 'Test ETH', (465, 178))
    arrow([(260, 340), (260, 395), (440, 395), (440, 440)], 'Session + hash', (72, 362))
    arrow([(810, 340), (810, 392), (680, 392), (680, 440)], 'Check receipt', (825, 365))
    arrow([(785, 530), (1100, 530), (1100, 370), (1150, 370)], 'USB commands / replies', (820, 560))
    d.text((55, 665), 'TRUST BOUNDARY: the contract does not verify fingerprints or physical cash.', fill='#65786B', font=small)
    im.save(ASSETS / 'architecture.png')


def make_slides():
    deck = {'width': 13.333333, 'height': 7.5, 'slides': []}
    notes_text = (OUT / 'SPEAKER_NOTES.md').read_text()
    notes_parts = re.split(r'## Slide \d+[^\n]*\n', notes_text)[1:]

    def new(title, kicker, dark=False):
        s = {'background': GREEN if dark else CREAM, 'elements': [], 'notes': ''}
        deck['slides'].append(s)
        n = len(deck['slides'])
        s['notes'] = notes_parts[n-1].split('## If asked')[0].strip()
        ink = WHITE if dark else GREEN
        txt(s, kicker.upper(), .65, .43, 11.8, .3, 10, LIME if dark else MUTED, True)
        txt(s, title, .65, .98, 12.0, 1.05, 32, ink, True)
        line(s, .65, 6.94, 12.0, '527061' if dark else 'DCE3D4')
        txt(s, 'DECENTRAPAY  /  LOCAL TEST FUNDS  /  COLLEGE PROTOTYPE', .65, 7.1, 11.3, .2, 8.5, LIME if dark else MUTED)
        txt(s, f'{n:02d}', 12.05, 7.06, .6, .25, 11, ink)
        return s

    def box(s, x, y, w, h, fill=WHITE):
        s['elements'].append({'type':'box','x':x,'y':y,'w':w,'h':h,'fill':fill})

    def txt(s, text, x, y, w, h, size=18, ink=GREEN, bold=False):
        s['elements'].append({'type':'text','text':text,'x':x,'y':y,'w':w,'h':h,'size':size,'color':ink,'bold':bold})

    def line(s, x, y, w, ink=MUTED, h=0, arrow=False):
        s['elements'].append({'type':'line','x':x,'y':y,'w':w,'h':h,'color':ink,'arrow':arrow})

    def card(s, x, y, w, h, number, title, body):
        box(s, x, y, w, h)
        txt(s, number, x+.22, y+.23, w-.44, .5, 25, MUTED)
        txt(s, title, x+.22, y+.92, w-.44, .65, 21, GREEN, True)
        txt(s, body, x+.22, y+1.72, w-.44, h-1.9, 17, MUTED)

    s = new('DecentraPay', 'Decentralized ATM System Using Web3', True)
    # Cover title is deliberately larger than the section-slide titles.
    s['elements'][1].update(size=54, h=1.1)
    txt(s, 'From a fingerprint\nto a confirmed payment\nto a visible action.', .7, 2.25, 7.5, 2.35, 30, WHITE)
    box(s, 9.25, 2.15, 3.35, 3.8, '285448')
    txt(s, '01  VERIFY\n\n02  APPROVE\n\n03  DISPENSE', 9.58, 2.55, 2.7, 3.1, 22, LIME, True)
    txt(s, '[Student / team]  •  [Roll number(s)]\n[College]  /  [Department]\nGuide: [Guide]  •  [Presentation date]', .7, 5.32, 8.3, 1.15, 14, LIME)

    s = new('One understandable workflow', '01 / Problem and objective')
    txt(s, 'Connect a digital transaction to an observable hardware response.', .7, 2.02, 11.7, .8, 24)
    card(s, .7, 3.02, 3.8, 3.32, '01', 'Identify', 'Match an enrolled fingerprint to the demo wallet.')
    card(s, 4.77, 3.02, 3.8, 3.32, '02', 'Authorize', 'Let the user approve a test payment in MetaMask.')
    card(s, 8.84, 3.02, 3.8, 3.32, '03', 'Observe', 'Verify confirmation, then run a servo and LED cycle.')

    s = new('A focused college prototype', '02 / Scope')
    box(s, .7, 2.08, 5.82, 4.35)
    box(s, 6.8, 2.08, 5.82, 4.35, PALE)
    txt(s, 'WHAT WE DEMONSTRATE', .98, 2.37, 5.2, .45, 16, GREEN, True)
    txt(s, 'One laptop + one ESP32\nOne enrolled demo wallet\nLocal Ethereum transactions\nFingerprint check + visible servo action', .98, 3.12, 5.1, 2.7, 21)
    txt(s, 'SIMULATION BOUNDARIES', 7.08, 2.37, 5.1, .45, 16, GREEN, True)
    txt(s, 'Test ETH and simulated rupees\nA single local blockchain node\nA trusted laptop-to-hardware bridge\nNo bank integration or real cash', 7.08, 3.12, 5.1, 2.7, 21)

    s = new('The laptop connects Web3 to the device', '03 / Architecture')
    for x, y, w, title, body in [(.7,2.2,4.25,'Browser + MetaMask','User interface and signature'),(8.35,2.2,4.25,'Local blockchain','Contract payment and event'),(.7,4.55,4.25,'Node.js bridge','Verify receipt; journal attempt'),(8.35,4.55,4.25,'ESP32 over USB','Fingerprint, servo and LED')]:
        box(s,x,y,w,1.45,WHITE)
        txt(s,title,x+.23,y+.2,w-.46,.45,21,GREEN,True)
        txt(s,body,x+.23,y+.84,w-.46,.42,14,MUTED)
    line(s,5.12,2.87,3.0,arrow=True)
    txt(s,'Signed test payment',5.2,2.35,2.9,.45,13,MUTED)
    line(s,2.82,3.72,0,h=.65,arrow=True)
    txt(s,'Session + hash',3.02,3.92,2.7,.3,12,MUTED)
    line(s,5.12,5.24,3.0,arrow=True)
    txt(s,'USB commands / replies',5.12,4.76,3.0,.4,13,MUTED)
    line(s,10.47,3.72,0,h=.60)
    line(s,4.2,4.32,6.27)
    line(s,4.2,4.32,0,h=.18,arrow=True)
    txt(s,'Bridge checks the chain receipt.',5.0,3.77,5.1,.4,13)
    txt(s,'The contract does not inspect fingerprints or physical cash.',.75,6.38,11.8,.35,14,MUTED)

    s = new('Four components, one USB connection', '04 / Hardware target')
    specs=[('ESP32','WROOM-32 board','USB link and peripheral control'),('R307','Fingerprint sensor','Templates stay inside the sensor'),('SG90','180° positional servo','A lightweight flap represents cash'),('LED','With 330 Ω resistor','Indicates the movement interval')]
    for i,(big,title,body) in enumerate(specs):
        x=.7+i*3.04
        box(s,x,2.15,2.8,3.55)
        txt(s,big,x+.2,2.5,2.4,.65,29,GREEN,True)
        txt(s,title,x+.2,3.43,2.4,.8,17,GREEN,True)
        txt(s,body,x+.2,4.4,2.4,1.0,15,MUTED)
    box(s,.7,6.0,11.95,.55,PALE)
    txt(s,'USB powers the ESP32. A separate rated 5 V supply powers peripherals; grounds are shared.',.93,6.13,11.45,.3,13)

    s = new('Small software. One smart contract.', '05 / Implementation')
    box(s,.7,2.1,5.55,4.45)
    txt(s,'LOCAL SOFTWARE',.98,2.4,4.95,.4,16,GREEN,True)
    txt(s,'HTML / CSS / JavaScript\nNode.js + Express\nethers + MetaMask\nSolidity + Hardhat\nArduino C++ + USB serial',.98,3.12,4.95,2.8,21)
    box(s,6.55,2.1,6.08,4.45,PALE)
    txt(s,'requestCash(requestId)',6.85,2.4,5.48,.45,23,GREEN,True)
    txt(s,'Accept a supported test ETH amount.\nReject a reused request ID.\nRecord a CashRequested event.',6.85,3.18,5.43,1.7,20)
    txt(s,'Rs 100 = 0.001 ETH\nRs 200 = 0.002 ETH\nRs 500 = 0.005 ETH',6.85,5.08,5.43,1.16,17)

    s = new('A payment must be confirmed before movement', '06 / Workflow')
    stages=[('01','Connect','Select the enrolled demo wallet.'),('02','Scan','Verify the finger for one request.'),('03','Approve','Sign the payment in MetaMask.'),('04','Dispense','Bridge verifies; ESP32 runs one cycle.')]
    for i,(num,title,body) in enumerate(stages):
        card(s,.7+i*3.04,2.25,2.8,3.65,num,title,body)
    txt(s,'Unknown finger → reject.  Cancelled approval → no dispense.  Lost USB reply → inspect; do not replay.',.8,6.2,11.85,.55,15,MUTED)

    s = new('Live demonstration', '07 / Show the complete flow', True)
    txt(s,'1  Show the mode, wallet and balance.\n2  Select Rs 100 and verify the finger.\n3  Approve the test payment in MetaMask.\n4  Show the hash and reduced balance.\n5  Observe the real servo and LED.',.85,2.12,9.1,3.8,26,WHITE)
    box(s,10.3,2.15,2.15,2.05,'285448')
    txt(s,'90',10.58,2.43,1.65,.8,49,LIME,True)
    txt(s,'SECONDS',10.61,3.42,1.6,.35,13,LIME)
    txt(s,'If using the simulator, say so clearly.\nDemonstrate an unknown finger being rejected if time allows.',.85,6.0,11.4,.7,16,LIME)

    s = new('Software evidence, with clear limits', '08 / Results')
    completed=[r for r in snapshot['requests'] if r['status']=='completed']
    for x,num,title,body in [(.7,'17','Tests passed','Contract + bridge checks'),(4.77,str(len(completed)),'Demo payments','Saved simulator journal'),(8.84,'—','Hardware tests','Pending physical assembly')]:
        card(s,x,2.1,3.8,3.47,num,title,body)
    txt(s,'Observed simulator payments: Rs 100, Rs 500 and Rs 200.\nUnknown-finger and sensor-error cases were also recorded.',.85,5.83,11.7,.75,17)
    txt(s,'No claim of real cash output, physical delivery assurance, or a distributed public network.',.85,6.6,11.7,.25,11,MUTED)

    s = new('A working software demo. A clear hardware path.', '09 / Conclusion')
    txt(s,'What the project connects',.8,2.2,11.4,.5,23,GREEN,True)
    txt(s,'Fingerprint authorization + wallet approval\n+ confirmed smart-contract payment + device control',.8,3.0,11.7,1.3,28)
    box(s,.75,4.8,11.9,1.3,PALE)
    txt(s,'FINAL ACCEPTANCE',1.02,5.02,3.0,.35,13,GREEN,True)
    txt(s,'Three observed physical withdrawals after assembly.',1.02,5.52,11.3,.4,19)
    txt(s,'Questions?',.85,6.38,5,.4,20,GREEN,True)
    (HERE/'slide-layout.json').write_text(json.dumps(deck,ensure_ascii=False,indent=2)+'\n')
    c=canvas.Canvas(str(OUT/'DecentraPay-Presentation.pdf'),pagesize=(960,540))
    c.setTitle('DecentraPay — Decentralized ATM System Using Web3')
    for i,s in enumerate(deck['slides']):
        c.setFillColor(color(s['background'])); c.rect(0,0,960,540,fill=1,stroke=0)
        for e in s['elements']:
            x,y,w,h=[e.get(k,0)*72 for k in ['x','y','w','h']]
            if e['type']=='box':
                c.setFillColor(color(e['fill'])); c.rect(x,540-y-h,w,h,fill=1,stroke=0)
            elif e['type']=='line':
                c.setStrokeColor(color(e['color'])); c.setLineWidth(1.2); c.line(x,540-y,x+w,540-y-h)
                if e.get('arrow'):
                    c.setFillColor(color(e['color'])); p=c.beginPath(); endx,endy=x+w,540-y-h
                    if w: p.moveTo(endx,endy); p.lineTo(endx-7,endy+4); p.lineTo(endx-7,endy-4)
                    else: p.moveTo(endx,endy); p.lineTo(endx-4,endy+7); p.lineTo(endx+4,endy+7)
                    p.close();c.drawPath(p,fill=1,stroke=0)
            else:
                p=para(e['text'],e['size'],e.get('bold'),e['color'],e['size']*1.16)
                _,ph=p.wrap(w,h)
                if ph>h+2: raise ValueError(f'Slide {i+1} text overflows: {e["text"][:60]} ({ph:.1f}>{h:.1f})')
                p.drawOn(c,x,540-y-ph)
        c.showPage()
    c.save()


def evidence_blocks():
    rows=[['Demo amount','Block','Mode','Saved result']]
    completed=[r for r in snapshot['requests'] if r['status']=='completed']
    for r in completed: rows.append([f'Rs {r["rupees"]}',str(r['blockNumber']),r['mode'],'Completed'])
    blocks=[{'type':'table','rows':rows}]
    for r in completed:
        blocks.append({'type':'p','small':True,'text':f'Rs {r["rupees"]} transaction: {r["txHash"]}'})
    return blocks


def expanded_blocks(page):
    out=[]
    for b in page['blocks']:
        out.extend(evidence_blocks() if b['type']=='evidence' else [b])
    return out


def make_report_pdf():
    width,height=A4; margin=48; avail=width-2*margin
    c=canvas.Canvas(str(OUT/'DecentraPay-Report.pdf'),pagesize=A4)
    c.setTitle(report['subtitle']); c.setAuthor('[Student / team]')
    for n,page in enumerate(report['pages'],1):
        c.setFillColor(color(CREAM)); c.rect(0,0,width,height,fill=1,stroke=0)
        c.setFillColor(color(GREEN)); c.rect(0,height-13,width,13,fill=1,stroke=0)
        c.setFont('DV',8); c.setFillColor(color(MUTED)); c.drawString(margin,height-39,'DECENTRAPAY  /  COLLEGE PROJECT REPORT')
        y=height-67
        title=report['title'] if page.get('cover') else page['title']
        p=para(title,38 if page.get('cover') else 24,True)
        _,h=p.wrap(avail,100);p.drawOn(c,margin,y-h);y-=h+20
        if page.get('cover'):
            p=para(report['subtitle'],22,False);_,h=p.wrap(avail,90);p.drawOn(c,margin,y-h);y-=h+40
        for b in expanded_blocks(page):
            t=b['type']
            if t in ['p','h','callout']:
                size=14 if t=='h' else 8.5 if b.get('small') else 10.5
                iscall=t=='callout'; inner=avail-22 if iscall else avail
                p=para(b['text'],size,t=='h',GREEN)
                _,h=p.wrap(inner,900)
                if iscall:
                    c.setFillColor(color(PALE));c.roundRect(margin,y-h-20,avail,h+20,6,fill=1,stroke=0)
                    p.drawOn(c,margin+11,y-h-10);y-=h+33
                else:
                    p.drawOn(c,margin,y-h);y-=h+(8 if b.get('small') else 12)
            elif t in ['bullets','refs']:
                for text in b['items']:
                    p=para(('•  ' if t=='bullets' else '')+text,9.8 if t=='bullets' else 8.2)
                    _,h=p.wrap(avail,900);p.drawOn(c,margin,y-h);y-=h+7
                y-=5
            elif t=='table':
                rows=b['rows']; cols=len(rows[0]);cw=[avail/cols]*cols
                if cols==2: cw=[avail*.33,avail*.67]
                if cols==3: cw=[avail*.29,avail*.15,avail*.56] if rows[0][1]=='Qty' else [avail*.25,avail*.52,avail*.23]
                cellrows=[[para(str(cell),9.1,i==0,WHITE if i==0 else GREEN,12.2) for cell in row] for i,row in enumerate(rows)]
                table=Table(cellrows,colWidths=cw,hAlign='LEFT')
                table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),color(GREEN)),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,color('EDF1E7')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.4,color('D6DFCF'))]))
                _,h=table.wrap(avail,1000);table.drawOn(c,margin,y-h);y-=h+15
            elif t=='figure':
                file=ASSETS/b['asset'];im=Image.open(file);h=avail*im.height/im.width
                c.drawImage(str(file),margin,y-h,width=avail,height=h);y-=h+7
                p=para(b['caption'],8.5,False,MUTED);_,h=p.wrap(avail,100);p.drawOn(c,margin,y-h);y-=h+16
            if y<57: raise ValueError(f'Report page {n} overflows: remaining y={y}')
        c.setStrokeColor(color('D9E0D2'));c.line(margin,42,width-margin,42)
        c.setFont('DV',8);c.setFillColor(color(MUTED));c.drawString(margin,28,'Local test funds • Physical verification pending at preparation')
        c.drawRightString(width-margin,28,f'{n:02d} / {len(report["pages"]):02d}')
        c.showPage()
    c.save()


def make_docx():
    """Minimal standard DOCX with editable paragraphs/tables and explicit page breaks."""
    W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    media={};rels=[];drawing_id=0
    def textpara(text,style='Normal',break_before=False):
        return (f'<w:p><w:pPr><w:pStyle w:val="{style}"/>' + ('<w:pageBreakBefore/>' if break_before else '') +
                '</w:pPr><w:r><w:t xml:space="preserve">'+xml_escape(text)+'</w:t></w:r></w:p>')
    def table(rows):
        n=len(rows[0]); widths=[int(9800/n)]*n
        if n==2:widths=[3300,6500]
        if n==3:widths=[2800,1500,5500] if rows[0][1]=='Qty' else [2500,5000,2300]
        xml='<w:tbl><w:tblPr><w:tblW w:w="9800" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'
        xml+=''.join(f'<w:gridCol w:w="{v}"/>' for v in widths)+'</w:tblGrid>'
        for i,row in enumerate(rows):
            xml+='<w:tr><w:trPr><w:cantSplit/>'+('<w:tblHeader/>' if i==0 else '')+'</w:trPr>'
            for j,cell in enumerate(row):
                fill=GREEN if i==0 else 'EDF1E7' if i%2==0 else WHITE
                xml+=f'<w:tc><w:tcPr><w:tcW w:w="{widths[j]}" w:type="dxa"/><w:shd w:fill="{fill}"/></w:tcPr>'
                xml+=textpara(str(cell),'TableHead' if i==0 else 'TableBody')+'</w:tc>'
            xml+='</w:tr>'
        return xml+'</w:tbl>'+textpara('','Small')
    def picture(file,caption):
        nonlocal drawing_id
        drawing_id+=1;name=f'image{drawing_id}.png';rid=f'rIdImage{drawing_id}'
        media[name]=file.read_bytes();rels.append((rid,'image',f'media/{name}'))
        im=Image.open(file);cx=6200000;cy=int(cx*im.height/im.width)
        xml=f'''<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{drawing_id}" name="{name}" descr="{xml_escape(caption)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="{drawing_id}" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'''
        return xml+textpara(caption,'Caption')
    body=[]
    for i,page in enumerate(report['pages']):
        body.append(textpara('DECENTRAPAY / COLLEGE PROJECT REPORT','Kicker',i>0))
        body.append(textpara(report['title'] if page.get('cover') else page['title'],'Title' if page.get('cover') else 'Heading1'))
        if page.get('cover'):body.append(textpara(report['subtitle'],'Subtitle'))
        for b in expanded_blocks(page):
            if b['type'] in ['p','h','callout']:
                body.append(textpara(b['text'],'Heading2' if b['type']=='h' else 'Callout' if b['type']=='callout' else 'Small' if b.get('small') else 'Normal'))
            elif b['type'] in ['bullets','refs']:
                body.extend(textpara(('• ' if b['type']=='bullets' else '')+t,'Small' if b['type']=='refs' else 'Normal') for t in b['items'])
            elif b['type']=='table':body.append(table(b['rows']))
            elif b['type']=='figure':body.append(picture(ASSETS/b['asset'],b['caption']))
    sect='<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="840" w:right="960" w:bottom="840" w:left="960" w:header="400" w:footer="400"/></w:sectPr>'
    namespaces=f'xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
    document=f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {namespaces}><w:body>'+''.join(body)+sect+'</w:body></w:document>'
    def style(sid,size,bold=False,ink=GREEN,spacing=130,extra=''):
        return f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{sid}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="{spacing}" w:line="270" w:lineRule="auto"/>{extra}</w:pPr><w:rPr><w:rFonts w:ascii="DejaVu Sans" w:hAnsi="DejaVu Sans"/><w:sz w:val="{size}"/><w:color w:val="{ink}"/>'+('<w:b/>' if bold else '')+'</w:rPr></w:style>'
    styles=f'<w:styles xmlns:w="{W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="DejaVu Sans" w:hAnsi="DejaVu Sans"/><w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>'
    styles+=f'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="150" w:line="285" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="{GREEN}"/></w:rPr></w:style>'
    styles+=style('Title',76,True,spacing=360)+style('Subtitle',40,spacing=500)+style('Heading1',46,True,spacing=240,extra='<w:keepNext/>')+style('Heading2',27,True,spacing=120,extra='<w:keepNext/>')+style('Kicker',16,False,MUTED,180)+style('Small',16,False,GREEN,100)+style('Caption',17,False,MUTED,180)+style('Callout',20,False,GREEN,180,extra=f'<w:shd w:fill="{PALE}"/>')+style('TableHead',18,True,WHITE,40)+style('TableBody',18,False,GREEN,40)+'</w:styles>'
    footer=f'<w:ftr xmlns:w="{W}">'+textpara('DecentraPay • Local test funds • Physical verification pending','Small')+'<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>'
    relbase='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    relsxml='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="{rid}" Type="{relbase}{typ}" Target="{target}"/>' for rid,typ,target in rels+[('rIdStyles','styles','styles.xml'),('rIdFooter','footer','footer1.xml')])+'</Relationships>'
    types='''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'''
    rootrels=f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{relbase}officeDocument" Target="word/document.xml"/></Relationships>'
    with zipfile.ZipFile(OUT/'DecentraPay-Report.docx','w',zipfile.ZIP_DEFLATED) as z:
        for name,data in {'[Content_Types].xml':types,'_rels/.rels':rootrels,'word/document.xml':document,'word/styles.xml':styles,'word/footer1.xml':footer,'word/_rels/document.xml.rels':relsxml}.items():z.writestr(name,data)
        for name,data in media.items():z.writestr('word/media/'+name,data)


def bench_pdf():
    w,h=A4;c=canvas.Canvas(str(OUT/'Bench-Checklist.pdf'),pagesize=A4)
    def page(title,sub):
        c.setFillColor(color(GREEN));c.rect(0,h-96,w,96,fill=1,stroke=0)
        p=para(title,24,True,WHITE);_,ph=p.wrap(w-80,100);p.drawOn(c,40,h-35-ph)
        c.setFont('DV',9);c.setFillColor(color(LIME));c.drawString(40,h-79,sub)
        return h-122
    def write(text,y,size=11):
        p=para(text,size);_,ph=p.wrap(w-80,800);p.drawOn(c,40,y-ph);return y-ph-14
    y=page('Bench setup checklist','DECENTRAPAY • PRINT BEFORE ASSEMBLY')
    for text in ['[ ] Verify actual board/sensor model and connector labels before powering.', '[ ] Upload the Arduino sketch; record the board and library versions.', '[ ] Sensor TX → GPIO16; sensor RX → GPIO17; servo signal → GPIO18.', '[ ] GPIO23 → 330 Ω resistor → LED anode; LED cathode → common ground.', '[ ] USB powers ESP32. External rated supply powers servo/sensor; share grounds.', '[ ] Do NOT join external +5 V to the USB-powered board 5 V / 3V3 pins.', '[ ] Close Arduino Serial Monitor and stop the ATM server before enrollment.', '[ ] Set HARDWARE_MODE=serial and actual SERIAL_PORT in .env.', 'npm run ports', 'npm run enroll -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'npm run hardware:check', '[ ] Observe one bench-test servo/LED cycle. This test does not make a payment.', 'npm run demo:reset', '[ ] Confirm ESP32 hardware mode, imported demo wallet, and local network.', '[ ] Perform three full withdrawals before and after enclosure mounting.']:
        y=write(text,y,9.5 if text.startswith('npm') else 10)
    c.showPage();y=page('Physical acceptance record','ALL RESULTS BELOW ARE BLANK / NOT RUN UNTIL OBSERVED')
    y=write('Observer: ____________________   Date: ____________________',y)
    y=write('Board/library versions: ___________________________________',y)
    for amount in [100,200,500]:
        y=write(f'Rs {amount}: finger matched [ ]   payment confirmed [ ]   ONE real servo/LED cycle [ ]',y,10)
        y=write('Transaction hash: _________________________________________________',y,9)
        y-=12
    for text in ['[ ] Unknown finger rejected without payment or movement.', '[ ] MetaMask rejection causes no dispense command.', '[ ] Disconnected device shows a clear failure.', '[ ] After any uncertain paid result, inspect hardware; do not replay the command.', '[ ] Repeat all three amounts after mounting the lightweight flap.', '[ ] Save assembly photos, a successful screen capture, and a labelled demo video.']:
        y=write(text,y,10)
    y=write('Notes / corrections: ______________________________________________',y)
    write('________________________________________________________________',y)
    c.showPage();c.save()


def labels_pdf():
    w,h=A4;c=canvas.Canvas(str(OUT/'ATM-Labels.pdf'),pagesize=A4)
    c.setFont('DV',10);c.setFillColor(color(MUTED));c.drawString(38,h-35,'DECENTRAPAY • Cut out labels; attach after testing the model')
    labels=[('DECENTRAPAY','Decentralized ATM System Using Web3',115),('FINGERPRINT VERIFICATION','Place the enrolled finger here',100),('SIMULATED CASH DISPENSER','Servo movement represents cash dispensing',100),('TEST FUNDS ONLY','Local blockchain • No real cash',95),('TRANSACTION INDICATOR','LED lights during the movement cycle',95)]
    y=h-65
    for title,subtitle,height in labels:
        c.setStrokeColor(color(MUTED));c.setDash(3,3);c.rect(38,y-height,w-76,height,fill=0,stroke=1);c.setDash()
        p=para(title,19,True);_,ph=p.wrap(w-105,100);p.drawOn(c,53,y-22-ph)
        p=para(subtitle,10,False,MUTED);_,ph=p.wrap(w-105,100);p.drawOn(c,53,y-height+18)
        y-=height+25
    c.save()


if __name__=='__main__':
    architecture()
    make_slides()
    make_report_pdf()
    make_docx()
    bench_pdf()
    labels_pdf()
    print('Generated slide PDF, 14-page report PDF/DOCX, architecture, bench sheet and labels.')
