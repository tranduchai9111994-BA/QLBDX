import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { syncDuePrices } from './services/pricing.service';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ message: 'Parking Management API' });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  // Ap dung ngay cac lich doi gia da den han trong luc server tat.
  syncDuePrices().catch((err) => console.error('Lỗi đồng bộ giá lúc khởi động:', err));
});

export default app;
