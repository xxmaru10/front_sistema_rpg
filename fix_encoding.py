import os

replacements = {
    'Ã“': 'Ó',
    'Ã³': 'ó',
    'Ãƒ': 'Ã',
    'Ã£': 'ã',
    'Ã‰': 'É',
    'Ã©': 'é',
    'ÃŠ': 'Ê',
    'Ãª': 'ê',
    'Ã': 'À',
    'Ã¡': 'á',
    'Ã': 'Í',
    'Ã­': 'í',
    'Ã§': 'ç',
    'Ã‡': 'Ç',
    'Ã•': 'Õ',
    'Ãµ': 'õ',
    'Ãš': 'Ú',
    'Ãº': 'ú',
    'Ã‚': 'Â',
    'Ã¢': 'â',
    'Ã”': 'Ô',
    'Ã´': 'ô',
}

def fix_encoding(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

path = r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src\features\session-notes'
fixed_files = []
for root, dirs, files in os.walk(path):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            if fix_encoding(os.path.join(root, file)):
                fixed_files.append(file)

print(f"Fixed files: {fixed_files}")
