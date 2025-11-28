# PDF Generation Workflow

## Complete Step-by-Step Guide to Generate Your Project Report PDF

This guide explains exactly **when** and **how** to insert images and generate your professional PDF report.

---

## Overview

Your report is already configured with Pandoc-ready image syntax. The workflow is:

1. **First** - Capture all 14 screenshots
2. **Second** - Save them in the correct location with correct names
3. **Third** - Update your personal details in the report
4. **Fourth** - Generate the PDF using the automated script

---

## Step 1: Install Required Software

### Install Pandoc

**macOS:**
```bash
brew install pandoc
```

**Ubuntu/Debian:**
```bash
sudo apt-get install pandoc
```

**Windows:**
Download from https://pandoc.org/installing.html

### Install LaTeX (Required for PDF generation)

**macOS (Recommended - smaller):**
```bash
brew install basictex
# After installation, add to PATH:
eval "$(/usr/libexec/path_helper)"
```

**macOS (Full - larger but complete):**
```bash
brew install --cask mactex
```

**Ubuntu/Debian:**
```bash
sudo apt-get install texlive-xetex texlive-fonts-recommended texlive-latex-extra
```

**Windows:**
Download MiKTeX from https://miktex.org/

### Verify Installation

```bash
pandoc --version
xelatex --version
```

Both should display version information if installed correctly.

---

## Step 2: Capture Screenshots (WHEN to Insert Images)

### Create the Images Directory

```bash
cd /Users/sanjyot/projects/ai-dependency-management/docs
mkdir -p images
```

### Screenshot List and File Names

You need to capture 14 screenshots and save them with these **exact** filenames:

#### Figure 1: Architecture Diagram (CREATE THIS)
- **Filename:** `images/figure-01-architecture.png`
- **What:** Create a system architecture diagram showing:
  - React Frontend (Port 8080)
  - Node.js Backend (Port 3001)
  - RabbitMQ (Port 5672)
  - Python AI Service (Port 8000)
  - MongoDB (Port 27017)
  - OpenAI API (External)
  - Arrows showing data flow
  - Labels: HTTP, WebSocket, AMQP protocols
- **Tool:** Use Draw.io (https://app.diagrams.net/), Lucidchart, or similar
- **Export:** PNG, 1200px wide

#### Figure 2: Technologies Stack (CREATE THIS)
- **Filename:** `images/figure-02-technologies.png`
- **What:** Grid/collage of technology logos
- **Include logos for:**
  - Frontend: React, TypeScript, Vite, Tailwind CSS
  - Backend: Node.js, Express
  - AI: Python, FastAPI, OpenAI
  - Infrastructure: MongoDB, RabbitMQ, Docker
  - Communication: Socket.IO
- **Tool:** PowerPoint, Canva, or simple image editor
- **Export:** PNG, organized in categories

#### Figure 3: GitHub OAuth Login
- **Filename:** `images/figure-03-login.png`
- **When to capture:** Start your application and go to `localhost:8080`
- **What to show:** Login page with "Sign in with GitHub" button
- **How:** Take screenshot (Cmd+Shift+4 on Mac, Windows+Shift+S on Windows)

#### Figure 4: Repository Selection
- **Filename:** `images/figure-04-repositories.png`
- **When to capture:** After logging in with GitHub
- **What to show:** List of your repositories
- **Ensure visible:** Repository names, languages, "Select" buttons

#### Figure 5: Scan Configuration
- **Filename:** `images/figure-05-configuration.png`
- **When to capture:** On the onboarding/settings page
- **What to show:** Scan frequency dropdown, notification settings
- **Note:** If you don't have this page yet, create a mockup or skip (PDF will note missing image)

#### Figure 6: Scan Progress
- **Filename:** `images/figure-06-scan-progress.png`
- **When to capture:** **During** an active scan (timing is important!)
- **What to show:** Progress spinner, status messages, counts updating
- **Tip:** Be ready to screenshot quickly after clicking "Scan"

#### Figure 7: Scan Results Dashboard
- **Filename:** `images/figure-07-results-dashboard.png`
- **When to capture:** After a scan completes
- **What to show:** Summary statistics, vulnerability counts, severity breakdown

#### Figure 8: Dependencies List
- **Filename:** `images/figure-08-dependencies-list.png`
- **When to capture:** Click "View Dependencies" from results
- **What to show:** Table with package names, versions, vulnerability counts

#### Figure 9: Vulnerability List
- **Filename:** `images/figure-09-vulnerability-list.png`
- **When to capture:** Click on a package that has vulnerabilities
- **What to show:** List of CVEs with severity badges (CVSS and AI)

#### Figure 10: AI Description
- **Filename:** `images/figure-10-ai-description.png`
- **When to capture:** Expand a vulnerability to show details
- **What to show:** The AI-generated plain-English description
- **Ensure visible:** Full 2-3 sentence explanation

#### Figure 11: AI Severity & Confidence
- **Filename:** `images/figure-11-ai-severity.png`
- **When to capture:** Same expanded vulnerability view
- **What to show:** AI severity badge + confidence percentage
- **Can be:** Same screenshot as Figure 10 if both are visible

#### Figure 12: Analysis Factors
- **Filename:** `images/figure-12-analysis-factors.png`
- **When to capture:** Fully expanded vulnerability analysis
- **What to show:** All factors - CVSS, exploitability, patch status, age, reasoning

#### Figure 13: WebSocket Notification
- **Filename:** `images/figure-13-websocket-notification.png`
- **When to capture:** **During** scan when AI analysis completes
- **What to show:** Toast notification appearing ("AI analysis complete...")
- **Timing:** Be quick! Notifications may auto-dismiss

#### Figure 14: Health Check
- **Filename:** `images/figure-14-health-check.png`
- **When to capture:** Open browser and go to `http://localhost:8000/health`
- **What to show:** JSON response with service status
- **Alternative:** Use Postman or terminal with `curl localhost:8000/health` and screenshot the output

---

## Step 3: Verify All Images

### Check Image Files

```bash
cd /Users/sanjyot/projects/ai-dependency-management/docs
ls -lh images/
```

You should see 14 files:
```
figure-01-architecture.png
figure-02-technologies.png
figure-03-login.png
figure-04-repositories.png
figure-05-configuration.png
figure-06-scan-progress.png
figure-07-results-dashboard.png
figure-08-dependencies-list.png
figure-09-vulnerability-list.png
figure-10-ai-description.png
figure-11-ai-severity.png
figure-12-analysis-factors.png
figure-13-websocket-notification.png
figure-14-health-check.png
```

### Image Quality Checklist

- [ ] All images are PNG or JPG format
- [ ] Images are clear and readable (not blurry)
- [ ] Text in screenshots is legible
- [ ] Images are properly cropped (no unnecessary content)
- [ ] File sizes are reasonable (< 2MB each)

---

## Step 4: Update Personal Information

### Edit the Report

```bash
cd /Users/sanjyot/projects/ai-dependency-management/docs
code Project_Report.md  # or use your preferred editor
```

### Update These Lines

**Line 7-8:** Replace with your information
```markdown
## Your Name

## Your Student ID
```

**Optional - In pandoc-config.yaml:**
```yaml
author: "Your Full Name"
```

---

## Step 5: Generate the PDF

### Option A: Using the Automated Script (Recommended)

```bash
cd /Users/sanjyot/projects/ai-dependency-management/docs
./generate-pdf.sh
```

The script will:
- ✓ Check if Pandoc and XeLaTeX are installed
- ✓ Verify the report and config files exist
- ✓ Count how many images are present (warns if < 14)
- ✓ Generate the PDF with professional formatting
- ✓ Display file size and offer to open the PDF

**Expected output:**
```
========================================
   AI Dependency Management Report
   PDF Generation Script
========================================

Found 14/14 images in docs/images/
Generating PDF...
  Report:  /Users/sanjyot/.../Project_Report.md
  Config:  /Users/sanjyot/.../pandoc-config.yaml
  Output:  /Users/sanjyot/.../AI_Dependency_Management_Report.pdf

✓ Success!
PDF generated: AI_Dependency_Management_Report.pdf
File size: 2.3M
```

### Option B: Manual Pandoc Command

```bash
cd /Users/sanjyot/projects/ai-dependency-management/docs

pandoc Project_Report.md \
  --defaults=pandoc-config.yaml \
  --output=AI_Dependency_Management_Report.pdf \
  --verbose
```

---

## Step 6: Review the PDF

### Open the PDF

**macOS:**
```bash
open docs/AI_Dependency_Management_Report.pdf
```

**Linux:**
```bash
xdg-open docs/AI_Dependency_Management_Report.pdf
```

**Windows:**
```bash
start docs/AI_Dependency_Management_Report.pdf
```

### What to Check

- [ ] **Table of Contents** - Clickable with page numbers
- [ ] **Page Numbers** - Bottom center of each page
- [ ] **Section Numbers** - Automatically generated (1, 1.1, 1.2, etc.)
- [ ] **All 14 Figures** - Images appear correctly
- [ ] **Figure Captions** - Properly formatted below each image
- [ ] **Bibliography** - All 13 references formatted correctly
- [ ] **Formatting** - Professional appearance, 1.5 line spacing
- [ ] **No Broken Links** - All image paths resolved

---

## Troubleshooting

### "Pandoc not found"
**Solution:** Install Pandoc (see Step 1)

### "xelatex not found"
**Solution:** Install LaTeX distribution (see Step 1)

### "Missing images" or broken image icons in PDF
**Solution:**
1. Verify images exist: `ls docs/images/`
2. Check filenames match exactly (case-sensitive)
3. Ensure images are in PNG or JPG format

### "Error: Unicode character error"
**Solution:** The config uses `xelatex` which supports Unicode. If you still get errors, check for special characters in your name/text.

### PDF formatting looks wrong
**Solution:**
1. Check `pandoc-config.yaml` is in the same directory
2. Verify you're using the script or `--defaults=pandoc-config.yaml` flag
3. Try deleting and regenerating the PDF

### Images too large/small in PDF
**Solution:** Edit image width in `Project_Report.md`:
```markdown
![Caption](images/file.png){width=90%}  ← Change percentage
```

### Table of Contents not clickable
**Solution:** Ensure you used `pdf-engine: xelatex` in config (already set)

---

## Advanced: Customization

### Change Page Margins

Edit `docs/pandoc-config.yaml`:
```yaml
geometry:
  - top=1in      ← Adjust these
  - bottom=1in
  - left=1.25in
  - right=1.25in
```

### Change Font or Size

Edit `docs/pandoc-config.yaml`:
```yaml
fontsize: 12pt        ← Change to 11pt or 14pt
mainfont: "Times New Roman"  ← Change font
```

### Change Line Spacing

Edit `docs/pandoc-config.yaml`:
```yaml
linestretch: 1.5  ← 1.0 = single, 2.0 = double
```

### Add Your Photo or University Logo

1. Save logo as `docs/images/logo.png`
2. Edit `pandoc-config.yaml`, add to `header-includes`:
```yaml
header-includes: |
  \usepackage{fancyhdr}
  \usepackage{graphicx}
  \fancyhead[L]{\includegraphics[height=0.5in]{images/logo.png}}
```

---

## Timeline Summary

### **NOW (Before Running App):**
1. Install Pandoc and LaTeX ← **DO THIS FIRST**
2. Create `docs/images/` directory
3. Update your name in `Project_Report.md`

### **WHILE Running App:**
4. Capture Figures 3-14 (screenshots)
5. Save with exact filenames in `docs/images/`

### **AFTER Capturing Screenshots:**
6. Create Figures 1-2 (diagrams)
7. Verify all 14 images exist
8. Run `./generate-pdf.sh`
9. Review and submit!

---

## Quick Reference: Commands

```bash
# Navigate to docs
cd /Users/sanjyot/projects/ai-dependency-management/docs

# Create images directory
mkdir -p images

# Generate PDF
./generate-pdf.sh

# Open PDF (macOS)
open AI_Dependency_Management_Report.pdf

# Check images
ls -lh images/
```

---

## Support

If you encounter issues:
1. Check the error message from Pandoc
2. Verify all prerequisites are installed
3. Ensure image files exist and are named correctly
4. Try generating a simple test: `pandoc --version`

---

**You're all set! Follow the steps in order and you'll have a professional PDF report ready for submission.**
