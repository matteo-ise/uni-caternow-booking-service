import hashlib
import os

def get_file_hash(filepath):
    """Berechnet einen MD5-Hash der Datei, um Änderungen zu erkennen."""
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()
