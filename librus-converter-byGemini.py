import pdfplumber
import pandas as pd
from pathlib import Path
import re

# --- CONFIGURATION ---
BASE_DIR = Path.home() / "librus-extractor"
INPUT_DIR = BASE_DIR / "input_files"
OUTPUT_DIR = BASE_DIR / "output_files"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def clean_cell(text):
    if text is None:
        return ""
    # Remove excessive newlines and double spaces often found in PDF exports
    text = str(text).replace('\n', ' ')
    return re.sub(r'\s+', ' ', text).strip()

def process_librus_pdf(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        
        # We use a tighter tolerance to prevent accidental column splitting
        table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "snap_tolerance": 3,
            "join_tolerance": 3,
        }
        
        table = page.extract_table(table_settings)
        if not table:
            return None

        headers = [
            "Przedmiot",
            "Okres 1: Oceny Bieżące", "Okres 1: Śr.I", "Okres 1: I",
            "Okres 2: Oceny Bieżące", "Okres 2: Śr.II", "Okres 2: II",
            "Koniec roku: Sr.R", "Koniec roku: R"
        ]

        final_rows = []
        
        # Usually, row 0 and 1 are headers. Data starts from index 2.
        for row in table[2:]:
            # Filter out empty rows
            if not any(row):
                continue
            
            # Clean all cells in the row
            cleaned_row = [clean_cell(c) for c in row]
            
            # REMEDIATION LOGIC: 
            # If the PDF parser produced more than 9 columns, it likely split a cell.
            # We merge everything from index 1 to (last - 7) back into the first 'Grades' column.
            if len(cleaned_row) > 9:
                subject = cleaned_row[0]
                # The last 7 columns are usually correctly identified (averages and finals)
                # We merge the "middle" mess back into the 'Oceny Bieżące' column
                grades_mess = " ".join([c for c in cleaned_row[1:-7] if c])
                remaining_cols = cleaned_row[-7:]
                cleaned_row = [subject, grades_mess] + remaining_cols
            
            # Ensure row is exactly 9 columns long for the CSV
            if len(cleaned_row) < 9:
                cleaned_row.extend([""] * (9 - len(cleaned_row)))
            else:
                cleaned_row = cleaned_row[:9]
                
            final_rows.append(cleaned_row)

        df = pd.DataFrame(final_rows, columns=headers)
        
        # Fix for 'Zachowanie' row placement
        mask = df['Przedmiot'].str.contains('Zachowanie', case=False, na=False)
        for idx in df[mask].index:
            row_vals = [v for v in df.loc[idx] if v and v != 'Zachowanie']
            new_row = ["Zachowanie"] + [""] * 8
            if row_vals:
                new_row[3] = row_vals[0] # Place behavior grade in 'Okres 1: I'
            df.loc[idx] = new_row

        return df

def main():
    for pdf_path in INPUT_DIR.glob("*.pdf"):
        print(f"Processing: {pdf_path.name}")
        try:
            df = process_librus_pdf(pdf_path)
            if df is not None:
                output_base = OUTPUT_DIR / pdf_path.stem
                df.to_csv(f"{output_base}.csv", index=False, encoding='utf-8-sig')
                df.to_excel(f"{output_base}.xlsx", index=False)
                print(f"Success: Created {pdf_path.stem}.csv and .xlsx")
        except Exception as e:
            print(f"Error on {pdf_path.name}: {e}")

if __name__ == "__main__":
    main()