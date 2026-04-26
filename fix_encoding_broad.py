import os

replacements = {
    'ÃƒÂ£': 'ã',
    'ÃƒÂ³': 'ó',
    'ÃƒÂ§': 'ç',
    'ÃƒÂ¡': 'á',
    'ÃƒÂ©': 'é',
    'ÃƒÂº': 'ú',
    'ÃƒÂ': 'í', # Wait, this might be tricky
    'ÃƒÂª': 'ê',
    'ÃƒÂ´': 'ô',
    'ÃƒÂ': 'â',
    'ÃƒÂ±': 'ñ',
    'ÃƒÂ': 'À',
    'Ãƒâ€¡': 'Ç',
    'Ãƒâ€ ' : 'Õ',
    'Ãƒâ€°': 'É',
    'Ãƒâ€ ': 'Ó',
    'Ãƒâ€ ': 'Á',

    # Double encoding patterns seen in diceVisuals.ts
    'ÃÃ‚Â§': 'ç',
    'ÃÃ‚Âµ': 'õ',
    'ÃÃ‚Â¡': 'á',
    'ÃÃ‚Â¢': 'â',
    'ÃÃ‚Â©': 'é',
    'ÃÃ‚Â­': 'í',
    'ÃÃ‚Âº': 'ú',
    'ÃÃ‚Â ': ' ', # might be something else
    
    # Single encoding patterns
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
    'Ã£o': 'ão',
}

def fix_encoding(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                content = f.read()
        except:
            return False
    
    new_content = content
    # Sort replacements by length of 'old' string to handle longer patterns first
    for old in sorted(replacements.keys(), key=len, reverse=True):
        new_content = new_content.replace(old, replacements[old])
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

path = r'c:\Users\danie\Desktop\RPG\CrownVtt\front_sistema_rpg\src'
fixed_files = []
for root, dirs, files in os.walk(path):
    if 'node_modules' in root or '.next' in root: continue
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            if fix_encoding(os.path.join(root, file)):
                fixed_files.append(os.path.join(os.path.relpath(root, path), file))

print(f"Fixed {len(fixed_files)} files.")
for f in fixed_files[:10]:
    print(f" - {f}")
if len(fixed_files) > 10:
    print("...")
