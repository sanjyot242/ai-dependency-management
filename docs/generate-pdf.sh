#!/bin/bash

# AI Dependency Management - PDF Generation Script
# This script generates a professional PDF report using Pandoc

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$DOCS_DIR/Project_Report.md"
CONFIG_FILE="$DOCS_DIR/pandoc-config.yaml"
OUTPUT_FILE="$DOCS_DIR/AI_Dependency_Management_Report.pdf"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   AI Dependency Management Report${NC}"
echo -e "${BLUE}   PDF Generation Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if Pandoc is installed
if ! command -v pandoc &> /dev/null; then
    echo -e "${RED}Error: Pandoc is not installed.${NC}"
    echo -e "${YELLOW}Please install Pandoc:${NC}"
    echo -e "  macOS:   ${GREEN}brew install pandoc${NC}"
    echo -e "  Ubuntu:  ${GREEN}sudo apt-get install pandoc${NC}"
    echo -e "  Windows: ${GREEN}Download from https://pandoc.org/installing.html${NC}"
    exit 1
fi

# Check if xelatex is installed (required for PDF generation)
if ! command -v xelatex &> /dev/null; then
    echo -e "${RED}Error: XeLaTeX is not installed.${NC}"
    echo -e "${YELLOW}Please install a TeX distribution:${NC}"
    echo -e "  macOS:   ${GREEN}brew install --cask mactex${NC}"
    echo -e "           ${GREEN}or brew install basictex${NC} (smaller)"
    echo -e "  Ubuntu:  ${GREEN}sudo apt-get install texlive-xetex texlive-fonts-recommended${NC}"
    echo -e "  Windows: ${GREEN}Download MiKTeX from https://miktex.org/${NC}"
    exit 1
fi

# Check if report file exists
if [ ! -f "$REPORT_FILE" ]; then
    echo -e "${RED}Error: Report file not found at $REPORT_FILE${NC}"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Config file not found at $CONFIG_FILE${NC}"
    exit 1
fi

# Check if images directory exists
if [ ! -d "$DOCS_DIR/images" ]; then
    echo -e "${YELLOW}Warning: images/ directory not found.${NC}"
    echo -e "${YELLOW}Creating images directory...${NC}"
    mkdir -p "$DOCS_DIR/images"
    echo -e "${YELLOW}Please add your screenshots to docs/images/ before generating the final PDF.${NC}"
    echo -e "${YELLOW}You can still generate the PDF now, but figures will show as missing.${NC}\n"

    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Exiting. Add images and run again.${NC}"
        exit 0
    fi
fi

# Count how many images exist
IMAGE_COUNT=$(find "$DOCS_DIR/images" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) 2>/dev/null | wc -l | tr -d ' ')
echo -e "${BLUE}Found ${IMAGE_COUNT}/14 images in docs/images/${NC}"

if [ "$IMAGE_COUNT" -lt 14 ]; then
    echo -e "${YELLOW}Note: Only $IMAGE_COUNT of 14 expected images found.${NC}"
    echo -e "${YELLOW}Missing images will appear as broken links in the PDF.${NC}\n"
fi

# Generate PDF
echo -e "${GREEN}Generating PDF...${NC}"
echo -e "  Report:  ${REPORT_FILE}"
echo -e "  Config:  ${CONFIG_FILE}"
echo -e "  Output:  ${OUTPUT_FILE}\n"

# Run Pandoc
pandoc "$REPORT_FILE" \
    --defaults="$CONFIG_FILE" \
    --output="$OUTPUT_FILE" \
    --verbose

# Check if PDF was created successfully
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "\n${GREEN}✓ Success!${NC}"
    echo -e "${GREEN}PDF generated: ${OUTPUT_FILE}${NC}"
    echo -e "${GREEN}File size: ${FILE_SIZE}${NC}\n"

    # Offer to open the PDF
    echo -e "${BLUE}Would you like to open the PDF now?${NC}"
    read -p "Open PDF? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$OUTPUT_FILE"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "$OUTPUT_FILE" 2>/dev/null || echo "Please open $OUTPUT_FILE manually"
        else
            echo "Please open $OUTPUT_FILE manually"
        fi
    fi
else
    echo -e "${RED}✗ Error: PDF generation failed${NC}"
    exit 1
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}========================================${NC}"
