import hashlib
import os

def get_file_hash(filepath):
    """Compute an MD5 hash of the file to detect changes between deployments."""
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()
