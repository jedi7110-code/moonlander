import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Serve prebuilt 3D Moonlander / TARAIRON observation app at /obs (mirrors vercel.json routing)
app.use('/obs', express.static(path.join(__dirname, 'obs', 'dist')));

// Block direct access to server/config files in root
app.use((req, res, next) => {
  const blocked = /^\/(server\.js|package(-lock)?\.json|metadata\.json)$/i;
  if (blocked.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

// Serve root 2D Moonlander static files (index.html, style.css, js/, assets/, obs.html)
app.use(express.static(__dirname, { dotfiles: 'ignore' }));

app.listen(PORT, HOST, () => {
  console.log(`Moon Lander server running at http://${HOST}:${PORT}`);
});
