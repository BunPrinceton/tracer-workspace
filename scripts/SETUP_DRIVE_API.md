# Google Drive API Setup

## Quick Setup (5 minutes)

### Step 1: Install dependencies
```bash
cd tracer_docs/scripts
pip install -r requirements.txt
```

### Step 2: Enable Google Drive API
1. Go to: https://console.cloud.google.com/
2. Select your project (or create one)
3. Go to **APIs & Services** → **Library**
4. Search for **"Google Drive API"**
5. Click **Enable**

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure consent screen:
   - User type: **External** (or Internal if using Google Workspace)
   - App name: "Tracer Docs Downloader"
   - Add your email as test user
4. Application type: **Desktop app**
5. Click **Create**
6. Click **Download JSON**
7. Rename to `credentials.json` and move to `tracer_docs/scripts/`

### Step 4: Run the script
```bash
python download_drive_docs.py --folder "0B3x8mikIsqYkcG9PcjJfZ1BaRDQ"
```

First run will open a browser for authorization. After that, it saves a token for future runs.

## Usage Examples

```bash
# Download as HTML (default, preserves formatting)
python download_drive_docs.py --folder "FOLDER_ID" --output ./docs_html

# Download as plain text
python download_drive_docs.py --folder "FOLDER_ID" --format txt --output ./docs_txt

# Full URL also works
python download_drive_docs.py --folder "https://drive.google.com/drive/folders/0B3x8mikIsqYkcG9PcjJfZ1BaRDQ"
```

## What it downloads

| Source | Output |
|--------|--------|
| Google Docs | `.html` or `.txt` |
| Google Sheets | `.csv` |
| Google Slides | `.txt` (extracted text) |
| Uploaded `.docx` | `.docx` + `.txt` (converted) |
| Uploaded `.pptx` | `.pptx` + `.txt` (converted) |
| Uploaded `.xlsx` | `.xlsx` + `.txt` (converted) |
| Images | Downloaded as-is |

## Troubleshooting

### "Access Denied" error
- Make sure Drive API is enabled
- Check that credentials.json is in the scripts folder
- Try deleting `drive_token.json` and re-authorizing

### "File not found" error
- Check folder ID is correct
- Make sure you have access to the folder
- Folder must be shared with your Google account

### Conversion errors
- Install python-docx for .docx files: `pip install python-docx`
- Install python-pptx for .pptx files: `pip install python-pptx`
- Install openpyxl for .xlsx files: `pip install openpyxl`
