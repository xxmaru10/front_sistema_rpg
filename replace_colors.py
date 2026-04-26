import os, re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    # For CharacterCard and SessionNotes (Default theme gold)
    content = re.sub(r'197,\s*160,\s*89', 'var(--accent-rgb)', content)
    content = re.sub(r'(?i)#c5a059', 'var(--accent-color)', content)
    
    # For Vampire System (Hardcoded Blood Red)
    content = re.sub(r'192,\s*57,\s*43', 'var(--accent-rgb)', content)
    content = re.sub(r'(?i)#c0392b', 'var(--accent-color)', content)
    
    # Fix the drop-shadow issue
    content = content.replace("drop-shadow(0 0 4px var(--accent-color)88)", "drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.5))")
    content = content.replace("drop-shadow(0 0 5px var(--accent-color)88)", "drop-shadow(0 0 5px rgba(var(--accent-rgb), 0.5))")

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

dirs = [
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\components\CharacterCard',
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\components\CombatCard',
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\systems\vampire',
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\features\session-notes',
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\styles',
    r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\hooks'
]

for d in dirs:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.css')) and 'themePresets' not in file:
                replace_in_file(os.path.join(root, file))
