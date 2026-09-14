import json
import struct
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path('/Users/sam/04-jianli/cc5794d1e7547b13bd1da14ff5bbbbc1.jpg')
out = root / 'assets' / 'character.glb'
image_path = root / 'assets' / 'character-texture.jpg'

Image.open(source).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS).save(image_path, quality=88, optimize=True)
image_bytes = image_path.read_bytes()

# A thin, double-sided character card: simple, lightweight, and rotatable in model-viewer.
faces = [
    ((-1, -1, 0.06), (1, -1, 0.06), (1, 1, 0.06), (-1, 1, 0.06), (0, 0, 1)),
    ((1, -1, -0.06), (-1, -1, -0.06), (-1, 1, -0.06), (1, 1, -0.06), (0, 0, -1)),
    ((-1, -1, -0.06), (-1, -1, 0.06), (-1, 1, 0.06), (-1, 1, -0.06), (-1, 0, 0)),
    ((1, -1, 0.06), (1, -1, -0.06), (1, 1, -0.06), (1, 1, 0.06), (1, 0, 0)),
    ((-1, 1, 0.06), (1, 1, 0.06), (1, 1, -0.06), (-1, 1, -0.06), (0, 1, 0)),
    ((-1, -1, -0.06), (1, -1, -0.06), (1, -1, 0.06), (-1, -1, 0.06), (0, -1, 0)),
]
positions, normals, uvs, indices = [], [], [], []
for face_index, (a, b, c, d, normal) in enumerate(faces):
    start = len(positions) // 3
    for p, uv in zip((a, b, c, d), ((0, 0), (1, 0), (1, 1), (0, 1))):
        positions += list(p); normals += list(normal); uvs += list(uv)
    indices += [start, start + 1, start + 2, start, start + 2, start + 3]

def pack(values, fmt):
    return struct.pack('<' + fmt * len(values), *values)

blob = pack(positions, 'f') + pack(normals, 'f') + pack(uvs, 'f') + pack(indices, 'H')
image_offset = len(blob)
blob += image_bytes
while len(blob) % 4: blob += b'\0'

pos_len = len(positions) * 4
norm_offset, norm_len = pos_len, len(normals) * 4
uv_offset, uv_len = norm_offset + norm_len, len(uvs) * 4
idx_offset, idx_len = uv_offset + uv_len, len(indices) * 2
buffer_views = [
    {'buffer': 0, 'byteOffset': 0, 'byteLength': pos_len, 'target': 34962},
    {'buffer': 0, 'byteOffset': norm_offset, 'byteLength': norm_len, 'target': 34962},
    {'buffer': 0, 'byteOffset': uv_offset, 'byteLength': uv_len, 'target': 34962},
    {'buffer': 0, 'byteOffset': idx_offset, 'byteLength': idx_len, 'target': 34963},
    {'buffer': 0, 'byteOffset': image_offset, 'byteLength': len(image_bytes)},
]
doc = {
    'asset': {'version': '2.0', 'generator': 'personal-site character card'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'Lin Chenglie Character'}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
    'accessors': [
        {'bufferView': 0, 'componentType': 5126, 'count': len(positions)//3, 'type': 'VEC3', 'min': [-1,-1,-.06], 'max': [1,1,.06]},
        {'bufferView': 1, 'componentType': 5126, 'count': len(normals)//3, 'type': 'VEC3'},
        {'bufferView': 2, 'componentType': 5126, 'count': len(uvs)//2, 'type': 'VEC2'},
        {'bufferView': 3, 'componentType': 5123, 'count': len(indices), 'type': 'SCALAR'},
    ],
    'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .82}, 'doubleSided': True}],
    'textures': [{'sampler': 0, 'source': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
    'images': [{'bufferView': 4, 'mimeType': 'image/jpeg'}],
    'buffers': [{'byteLength': len(blob)}], 'bufferViews': buffer_views,
}
json_bytes = json.dumps(doc, separators=(',', ':')).encode()
while len(json_bytes) % 4: json_bytes += b' '
def chunk(kind, data): return struct.pack('<I4s', len(data), kind) + data
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(json_bytes) + 8 + len(blob))
glb += chunk(b'JSON', json_bytes) + chunk(b'BIN\0', blob)
out.write_bytes(glb)
print(out)
