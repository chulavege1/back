import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' }));

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const IMAGES_FOLDER = path.resolve(__dirname, 'images');
const IMAGE_CATEGORIES = {
  robot: 'robot',
  car: 'car',
  nature: 'nature',
};

const downloadImage = async (url: string, filePath: string) => {
  const response = await axios({ url, responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

// const fetchImagesFromPexels = async (query: string, category: string) => {
//   try {
//     const response = await axios.get('https://api.pexels.com/v1/search', {
//       headers: { Authorization: PEXELS_API_KEY },
//       params: { query, per_page: 9 },
//     });

//     const folderPath = path.join(IMAGES_FOLDER, category);
//     if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

//     for (const photo of response.data.photos) {
//       const tags = photo.alt.toLowerCase();
//       const existingFiles = fs.readdirSync(folderPath);

//       if (
//         tags.includes(query.toLowerCase()) &&
//         !existingFiles.includes(`${crypto.createHash('md5').update(photo.src.medium).digest('hex')}.jpg`)
//       ) {
//         const fileName = `${crypto.createHash('md5').update(photo.src.medium).digest('hex')}.jpg`;
//         const filePath = path.join(folderPath, fileName);
//         await downloadImage(photo.src.medium, filePath);
//       }
//     }
//   } catch (error) {
//     console.error(`Error fetching images for category ${category}:`, error);
//   }
// };

// const initializeImages = async () => {
//   for (const [key, query] of Object.entries(IMAGE_CATEGORIES)) {
//     await fetchImagesFromPexels(query, key);
//   }
// };

app.get('/api/captcha', (req, res) => {
  try {
    const images = {};

    Object.entries(IMAGE_CATEGORIES).forEach(([key, category]) => {
      const folderPath = path.join(IMAGES_FOLDER, category);
      if (fs.existsSync(folderPath)) {
        images[key] = fs
          .readdirSync(folderPath)
          .filter(file => file.endsWith('.jpg'))
          .map(file => ({
            name: file.split('.')[0],
            url: `/images/${category}/${file}`,
          }));
      }
    });

    const categoriesWithImages = Object.keys(images).filter(cat => images[cat] && images[cat].length > 0);
    if (categoriesWithImages.length === 0) {
      throw new Error('No images available for captcha.');
    }

    const taskCategory = categoriesWithImages[Math.floor(Math.random() * categoriesWithImages.length)];
    const numCorrect = Math.random() < 0.5 ? 3 : 3;
    const numImages = numCorrect + 6;

    const correctImages = images[taskCategory].slice(0, numCorrect);
    const incorrectImages = categoriesWithImages
      .filter(key => key !== taskCategory)
      .flatMap(key => images[key])
      .slice(0, numImages - numCorrect);

    const allImages = [...correctImages, ...incorrectImages].sort(() => Math.random() - 0.5);

    const sessionId = crypto.randomUUID();
    res.json({ sessionId, task: taskCategory, images: allImages });
  } catch (error) {
    console.error('Ошибка генерации капчи:', error);
    res.status(500).json({ error: 'Не удалось сгенерировать капчу.' });
  }
});

app.post('/api/captcha/validate', (req, res) => {
  const { selected, task } = req.body;

  if (!Array.isArray(selected) || typeof task !== 'string') {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  const folderPath = path.join(IMAGES_FOLDER, task);
  const correctImages = fs
    .readdirSync(folderPath)
    .filter(file => file.endsWith('.jpg'))
    .map(file => file.split('.')[0]);

  const incorrectSelections = selected.filter(name => !correctImages.includes(name));
  const isValid = selected.length >= 3 && incorrectSelections.length === 0;

  res.json({ success: isValid });
});

app.use('/images', express.static(IMAGES_FOLDER));

// initializeImages().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
// });
