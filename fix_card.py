import os, re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Replace default gold colors
    content = re.sub(r'197,\s*160,\s*89', 'var(--accent-rgb)', content)
    content = re.sub(r'(?i)#c5a059', 'var(--accent-color)', content)
    
    # Remove local overrides
    content = re.sub(r'\.(operative|threat)-arcano\s*\{[^}]*\}', '', content)
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

dirs = [
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\components\CharacterCard'
]

for d in dirs:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.css')):
                replace_in_file(os.path.join(root, file))
