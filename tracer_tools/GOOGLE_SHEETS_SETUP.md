# Google Sheets API Setup Guide

## Option A: Service Account (Recommended for Scripts)

### Step 1: Create Service Account
1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### Step 2: Create Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Give it a name (e.g., "tracer-tools-sheets")
4. Click "Create and Continue"
5. Skip optional steps, click "Done"

### Step 3: Generate Key
1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose **JSON** format
5. Download the JSON file

### Step 4: Save Credentials
```bash
# Move downloaded JSON to:
mv ~/Downloads/your-project-xxxxx.json ~/Downloads/tracer_tools/google_credentials.json
```

### Step 5: Share Sheets with Service Account
For each Google Sheet you want to access:
1. Open the Sheet
2. Click "Share"
3. Add the service account email (found in the JSON, looks like: `xxx@xxx.iam.gserviceaccount.com`)
4. Give it "Editor" access

---

## Option B: OAuth (Personal Account)

### Step 1: Enable API
Same as Option A Step 1

### Step 2: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure consent screen if prompted
4. Application type: "Desktop app"
5. Download credentials.json

### Step 3: First Run
First time you run a script, it will:
1. Open a browser
2. Ask you to authorize access
3. Save token for future use

---

## Testing Connection

```bash
python scripts/test_sheets_connection.py
```

This will verify you can read/write to Sheets.
