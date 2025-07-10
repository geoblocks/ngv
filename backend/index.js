import express from 'express';
import {z} from 'zod';
import {v4 as uuidv4} from 'uuid';
import {promises as fs} from 'fs';
import path from 'path';

const POI_SCHEMA = z.object({
  id: z.string().uuid(),
  title: z.string(),
  coordinate: z.tuple([z.number(), z.number()]),
  kind: z.enum(['stone', 'wood']),
  urgency: z.enum(['low', 'medium', 'critical']),
});

const DATA_DIR = path.join(process.cwd(), 'backend_data');

async function ensureDataDir() {
  try {
    await fs.readdir(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, {recursive: true});
  }
}

async function savePOI(poi) {
  await fs.writeFile(
    path.join(DATA_DIR, poi.id + '.json'),
    JSON.stringify(poi, null, 2),
  );
}

async function getPOI(id) {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, id + '.json'), 'utf-8');
    return POI_SCHEMA.parse(JSON.parse(data));
  } catch {
    return null;
  }
}

async function listPOIs() {
  const files = await fs.readdir(DATA_DIR);
  const pois = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      const poi = await getPOI(file.replace('.json', ''));
      if (poi) pois.push(poi);
    }
  }
  return pois;
}

async function deletePOI(id) {
  await fs.unlink(path.join(DATA_DIR, id + '.json'));
}

await ensureDataDir();

const app = express();
app.use(express.json());

app.get('/pois', async (req, res) => {
  const pois = await listPOIs();
  res.json(pois);
});

app.post('/pois', async (req, res) => {
  const parsed = POI_SCHEMA.safeParse({...req.body, id: uuidv4()});
  if (!parsed.success) {
    return res.status(400).json({error: parsed.error});
  }
  await savePOI(parsed.data);
  res.status(201).json(parsed.data);
});

app.get('/pois/:id', async (req, res) => {
  const poi = await getPOI(req.params.id);
  if (!poi) return res.status(404).send('Not found');
  res.json(poi);
});

app.put('/pois/:id', async (req, res) => {
  const parsed = POI_SCHEMA.safeParse({...req.body, id: req.params.id});
  if (!parsed.success) {
    return res.status(400).json({error: parsed.error});
  }
  await savePOI(parsed.data);
  res.json(parsed.data);
});

app.delete('/pois/:id', async (req, res) => {
  await deletePOI(req.params.id);
  res.status(204).send();
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`POI backend listening on port ${PORT}`);
});
