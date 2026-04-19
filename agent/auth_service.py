import os
import csv
from datetime import datetime, timezone

# Mock Cloud Auth Service with CSV fallback

CSV_FILE = os.path.join(os.path.dirname(__file__), "users.csv")

def _ensure_csv_exists():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["email", "password", "created_at"])

def register_user(email: str, password: str):
    """
    Simulates Cloud Auth registration. Falls back to CSV.
    """
    _ensure_csv_exists()
    
    # Check if user exists
    with open(CSV_FILE, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["email"] == email:
                return False, "User already exists."

    # Write to CSV (simulating fallback)
    with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([email, password, datetime.now(timezone.utc).isoformat()])
        
    return True, "User registered successfully via Cloud (Fallback: CSV)."

def login_user(email: str, password: str):
    """
    Simulates Cloud Auth login. Falls back to CSV.
    """
    _ensure_csv_exists()
    
    with open(CSV_FILE, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["email"] == email:
                if row["password"] == password:
                    return True, "Login successful."
                else:
                    return False, "Invalid password."
                    
    return False, "User not found."
