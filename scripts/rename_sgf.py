import os
import re

def extract_tag(content, tag):
    match = re.search(rf'{tag}\[([^\]]+)\]', content)
    return match.group(1) if match else None

for file in os.listdir('.'):
    if file.endswith('.sgf'):
        with open(file, 'r') as f:
            content = f.read()
        dt = extract_tag(content, 'DT')
        pb = extract_tag(content, 'PB')
        pw = extract_tag(content, 'PW')
        if pb == 'joeykb':
            opponent = pw
        else:
            opponent = pb
        new_content = content.replace('级', 'k')
        with open(file, 'w') as f:
            f.write(new_content)
        new_name = f"{dt}-[{opponent}].sgf"
        os.rename(file, new_name)
        print(f"Renamed {file} to {new_name}")