import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
    const ort = require('onnxruntime-node');
    console.log('ONNX Loaded via CreateRequire:', ort);
} catch (e) {
    console.error('CreateRequire Failed:', e);
}
