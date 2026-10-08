require('dotenv').config();
require('./db'); // ensures schema is created on boot
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'new-avenue-1-api' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/units', require('./routes/units'));
app.use('/api/owners', require('./routes/owners'));
app.use('/api/daily-reports', require('./routes/dailyReports'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reference', require('./routes/reference'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`New Avenue 1 API listening on http://localhost:${PORT}`));
