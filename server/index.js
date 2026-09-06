const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Temp Mail Server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📧 Mail API: http://localhost:${PORT}/api/mail`);
  console.log(`=================================================`);
});
