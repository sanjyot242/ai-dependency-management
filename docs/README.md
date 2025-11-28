# Project Report Documentation

This directory contains everything you need to generate your **AI-Powered Dependency Management System** project report PDF.

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `Project_Report.md` | Main report content (edit to add your name) |
| `pandoc-config.yaml` | Pandoc configuration for PDF formatting |
| `generate-pdf.sh` | Automated script to generate PDF |
| `PDF_GENERATION_WORKFLOW.md` | **📖 START HERE** - Complete step-by-step guide |
| `images/` | Directory for your 14 screenshots |
| `images/IMAGE_CHECKLIST.md` | Checklist of required screenshots |

## 🚀 Quick Start

### 1. **Read the Workflow Guide First**
```bash
open PDF_GENERATION_WORKFLOW.md
```
This contains everything you need to know!

### 2. **Install Prerequisites**
```bash
# macOS
brew install pandoc basictex

# Ubuntu
sudo apt-get install pandoc texlive-xetex texlive-fonts-recommended
```

### 3. **Capture Screenshots**
- Run your application
- Capture all 14 screenshots listed in `images/IMAGE_CHECKLIST.md`
- Save them in `docs/images/` with exact filenames

### 4. **Update Your Name**
Edit `Project_Report.md` lines 7-8:
```markdown
## Your Name Here
## Your Student ID Here
```

### 5. **Generate PDF**
```bash
./generate-pdf.sh
```

Done! Your PDF will be created as `AI_Dependency_Management_Report.pdf`

## 📋 What You Get

The generated PDF includes:

✅ **Professional formatting**
- Automatic page numbers
- Clickable table of contents
- Numbered sections (1, 1.1, 1.2, etc.)
- 1.5 line spacing
- Times New Roman 12pt font

✅ **Complete content**
- Abstract
- 9 main sections
- 14 figures with captions
- 13 bibliography references

✅ **Academic layout**
- Title page with your details
- Proper margins (1" top/bottom, 1.25" sides)
- List of figures
- Professional appearance

## ❓ When to Insert Images

**Answer: BEFORE generating the PDF**

The workflow is:
1. Run your application → Capture screenshots → Save to `docs/images/`
2. Run `./generate-pdf.sh` → PDF auto-includes all images

The markdown already has the image syntax configured. You just need to provide the actual image files.

## 📊 Image Requirements

You need **14 images total**:

- **2 diagrams** (create with Draw.io): Architecture, Tech stack
- **12 screenshots** (capture from running app): Login, scans, vulnerabilities, AI analysis

See `images/IMAGE_CHECKLIST.md` for the complete list.

## 🔧 Troubleshooting

**"Command not found: pandoc"**
→ Install Pandoc (see step 2 above)

**"xelatex not found"**
→ Install LaTeX distribution (basictex or texlive)

**"Missing images in PDF"**
→ Check `ls docs/images/*.png` shows all 14 files

**More help:**
→ Read `PDF_GENERATION_WORKFLOW.md` section "Troubleshooting"

## 📞 Need Help?

1. Check error messages carefully
2. Read `PDF_GENERATION_WORKFLOW.md` (comprehensive guide)
3. Verify prerequisites: `pandoc --version` and `xelatex --version`
4. Ensure images exist: `ls -lh images/`

## 📝 Customization

Want to change formatting? Edit `pandoc-config.yaml`:

```yaml
fontsize: 12pt        # Change font size
linestretch: 1.5      # Change line spacing
geometry:
  - top=1in           # Adjust margins
mainfont: "Times New Roman"  # Change font
```

Then regenerate: `./generate-pdf.sh`

## ✅ Final Checklist

Before generating your PDF:

- [ ] Pandoc installed
- [ ] LaTeX (xelatex) installed
- [ ] All 14 images saved in `docs/images/`
- [ ] Your name updated in `Project_Report.md`
- [ ] Student ID updated in `Project_Report.md`

Then run: `./generate-pdf.sh`

---

**You're all set! Follow the workflow and you'll have a professional PDF report ready in minutes.**

Good luck with your CPSC-597 project! 🎓
