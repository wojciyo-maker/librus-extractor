### Updated Python Script (`extractor.py`)

#This script will look into your `input_files` directory, process every PDF it finds, and save a corresponding `.csv` and `.xlsx` file into the `output_files` directory.

```python
import pdfplumber
import pandas as pd
import os
from pathlib import Path

# --- CONFIGURATION ---
# Use expanduser to handle the '~' symbol automatically
BASE_DIR = Path("~/librus-extractor").expanduser()
INPUT_DIR = BASE_DIR / "input_files"
OUTPUT_DIR = BASE_DIR / "output_files"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def extract_librus_table(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        # Process only the first page as requested
        page = pdf.pages[0]
        
        # Extract the table
        # We use 'lines' strategy because Librus PDFs usually have clear borders
        table = page.extract_table({
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
        })

        if not table:
            return None

        # Prepare headers according to your specific requirements
        # Column headers: "Przedmiot", "Okres 1", "Okres 2", "Koniec roku"
        # Sub-columns: "Oceny Bieżące", "Śr.I", "I", etc.
        headers = [
            "Przedmiot",
            "Okres 1: Oceny Bieżące", "Okres 1: Śr.I", "Okres 1: I",
            "Okres 2: Oceny Bieżące", "Okres 2: Śr.II", "Okres 2: II",
            "Koniec roku: Sr.R", "Koniec roku: R"
        ]

        # The first two rows in the PDF table are usually the headers we are replacing
        # We take the data starting from row 2 (index 2)
        data_rows = table[2:]
        
        # Create DataFrame
        df = pd.DataFrame(data_rows)
        
        # Ensure we only have 9 columns to match our headers
        df = df.iloc[:, :9]
        df.columns = headers
        
        # Clean up newlines within cells (common in Librus PDFs)
        df = df.replace('\n', ' ', regex=True)
        
        return df

def main():
    pdf_files = list(INPUT_DIR.glob("*.pdf"))
    
    if not pdf_files:
        print(f"No PDF files found in {INPUT_DIR}")
        return

    for pdf_path in pdf_files:
        print(f"Processing: {pdf_path.name}")
        try:
            df = extract_librus_table(pdf_path)
            
            if df is not None:
                # Generate output filenames
                base_name = pdf_path.stem
                csv_output = OUTPUT_DIR / f"{base_name}.csv"
                xlsx_output = OUTPUT_DIR / f"{base_name}.xlsx"
                
                # Save as CSV
                df.to_csv(csv_output, index=False, encoding='utf-8-sig')
                # Save as Excel
                df.to_excel(xlsx_output, index=False)
                
                print(f"Successfully saved to {OUTPUT_DIR}")
        except Exception as e:
            print(f"Error processing {pdf_path.name}: {e}")

if __name__ == "__main__":
    main()

```

### 1. Setup on your VM

#Connect to your VM and install the necessary libraries:

```bash
pip install pdfplumber pandas openpyxl

```

#Ensure your directory structure exists:

```bash
mkdir -p ~/librus-extractor/input_files
mkdir -p ~/librus-extractor/output_files

```

### 2. Set up the Daily Automation (Cron)

#To make this run daily on your VM, you will add it to the system's `crontab`.

#1. Open the crontab editor:
```bash
crontab -e

```


#2. Add the following line at the bottom (this example runs it every morning at 7:00 AM):
```bash
00 07 * * * /usr/bin/python3 /home/wojciyo/librus-extractor/extractor.py >> /home/wojciyo/librus-extractor/log.txt 2>&1

```


#*Note: Use `which python3` in your terminal to confirm the path to your python executable.*

### 3. How it works

#* **Input**: Drop any Librus grade PDF into `~/librus-extractor/input_files`.
#* **Processing**: The script uses a "table extraction strategy" based on the lines in the PDF, which is the most reliable way to handle the merged cells found in school reports.
#* **Output**: It generates both a `.csv` and an `.xlsx` file for every PDF processed, cleaning up the text formatting (removing extra line breaks) in the process.