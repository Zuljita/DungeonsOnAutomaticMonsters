import json
import os
import re
import copy
import uuid

def generate_id():
    # GCS uses a specific random ID format, we can just use uuid4 strings or simulate it
    return str(uuid.uuid4())[:16].replace('-', '')

def load_library():
    lib_path = r"data\GCS Master Library\Basic Set\Basic Set Traits.adq"
    with open(lib_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    traits_dict = {}
    for row in data.get("rows", []):
        name = row.get("name", "")
        if name:
            # Clean name (remove @Type@ kind of things or just store lower)
            clean_name = re.sub(r'@.*?@', '', name).strip().lower()
            if clean_name not in traits_dict:
                traits_dict[clean_name] = row
            traits_dict[name.lower()] = row
    return traits_dict

def extract_core_name(trait_str):
    # 'Amphibious (Accessibility, Only skill penalties)' -> 'Amphibious'
    return trait_str.split('(')[0].strip()

def build_gcts():
    traits_dict = load_library()
    
    with open(r"converted\enraged-eggplant\doa-monsters.review-required.json", "r", encoding="utf-8") as f:
        monsters_data = json.load(f)
        
    out_dir = r"data\enraged-eggplant\gcs-races"
    os.makedirs(out_dir, exist_ok=True)
    
    count = 0
    for monster in monsters_data.get("monsters", []):
        name = monster.get("name", "Unknown")
        
        gct = {
            "version": 5,
            "id": generate_id(),
            "profile": {
                "name": name,
                "SM": int(monster.get("size", {}).get("heightSizeModifier", 0))
            },
            "traits": [
                {
                    "id": generate_id(),
                    "name": name,
                    "ancestry": "Monster",
                    "container_type": "ancestry",
                    "children": []
                }
            ]
        }
        
        # Attributes
        attrs = monster.get("stats", {}).get("attributes", {})
        
        base_st = attrs.get("st")
        if base_st is not None and isinstance(base_st, int) and base_st != 10:
            gct["traits"][0]["children"].append({
                "id": generate_id(),
                "name": f"ST {base_st}",
                "reference": "B14",
                "features": [{"type": "attribute_bonus", "attribute": "st", "amount": base_st - 10}]
            })
            
        base_dx = attrs.get("dx")
        if base_dx is not None and isinstance(base_dx, int) and base_dx != 10:
            gct["traits"][0]["children"].append({
                "id": generate_id(),
                "name": f"DX {base_dx}",
                "reference": "B14",
                "features": [{"type": "attribute_bonus", "attribute": "dx", "amount": base_dx - 10}]
            })
            
        base_iq = attrs.get("iq")
        if base_iq is not None and isinstance(base_iq, int) and base_iq != 10:
            gct["traits"][0]["children"].append({
                "id": generate_id(),
                "name": f"IQ {base_iq}",
                "reference": "B15",
                "features": [{"type": "attribute_bonus", "attribute": "iq", "amount": base_iq - 10}]
            })
            
        base_ht = attrs.get("ht")
        if base_ht is not None and isinstance(base_ht, int) and base_ht != 10:
            gct["traits"][0]["children"].append({
                "id": generate_id(),
                "name": f"HT {base_ht}",
                "reference": "B15",
                "features": [{"type": "attribute_bonus", "attribute": "ht", "amount": base_ht - 10}]
            })
            
        # Traits
        for t_str in monster.get("stats", {}).get("traits", []):
            core = extract_core_name(t_str)
            if core.lower() in traits_dict:
                lib_trait = copy.deepcopy(traits_dict[core.lower()])
                # update IDs recursively
                def update_ids(node):
                    node["id"] = generate_id()
                    if "modifiers" in node:
                        for m in node["modifiers"]:
                            m["id"] = generate_id()
                    if "children" in node:
                        for c in node["children"]:
                            update_ids(c)
                update_ids(lib_trait)
                
                # set name to the full string from monster if we want
                lib_trait["name"] = t_str
                gct["traits"][0]["children"].append(lib_trait)
            else:
                # Generic fallback
                gct["traits"][0]["children"].append({
                    "id": generate_id(),
                    "name": t_str,
                    "tags": ["Physical"]
                })
                
        out_path = os.path.join(out_dir, f"{name}.gct")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(gct, f, indent=4)
            
        count += 1
        
    print(f"Generated {count} .gct files.")

if __name__ == "__main__":
    build_gcts()
