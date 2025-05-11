#!/usr/bin/env python3

import os
from pathlib import Path

# Define the desired directory structure and files
structure = {
    'css': ['main.css'],
    'js': [
        'auth.js',
        'dashboard.js',
        'products.js',
        'transactions.js',
        'finance.js',
        'utils.js',
    ],
    'admin': ['index.html', 'verifications.html', 'users.html'],
    'merchant': ['dashboard.html', 'products.html', 'transactions.html', 'finance.html'],
    # Root-level files
    '.': ['index.html', 'login.html', 'register.html'],
}

def create_structure(base_dir: Path, spec: dict):
    """
    Given a base directory and a spec dict mapping subdirs to lists of filenames,
    create all directories and empty files as needed.
    """
    for subdir, files in spec.items():
        # Compute directory path
        dir_path = base_dir if subdir == '.' else base_dir / subdir
        dir_path.mkdir(parents=True, exist_ok=True)
        # Create each file
        for filename in files:
            file_path = dir_path / filename
            if not file_path.exists():
                file_path.touch()
                print(f"Created: {file_path}")
            else:
                print(f"Already exists: {file_path}")

if __name__ == '__main__':
    # Assume this script lives in the riskpay-frontend folder
    base_directory = Path(__file__).parent.resolve()
    create_structure(base_directory, structure)
