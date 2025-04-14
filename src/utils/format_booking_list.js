const fs = require('fs').promises;
const path = require('path');

// Girdi ve çıktı dosyalarının yolları
const inputFile = path.resolve(__dirname, '../../extracted_hotel_links_10-11_april.txt');
const outputFile = path.resolve(__dirname, '../room-scraper/booking-list.js');

async function formatLinks() {
  try {
    // hotel_links.txt dosyasını oku
    const content = await fs.readFile(inputFile, 'utf8');
    
    // Satırları ayır ve boş satırları filtrele
    const links = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Array formatında string oluştur
    const arrayString = `// Bu dosya otomatik olarak oluşturulmuştur
// Kaynak: extracted_hotel_links_10-11_april.txt

const bookingList = [
  ${links.map(link => `"${link}"`).join(',\n  ')}
];

module.exports = bookingList;
`;

    // booking-list.js dosyasını güncelle
    await fs.writeFile(outputFile, arrayString, 'utf8');
    console.log(`booking-list.js başarıyla güncellendi. Toplam ${links.length} link işlendi.`);

  } catch (error) {
    console.error(`Hata oluştu: ${error.message}`);
    process.exit(1);
  }
}

formatLinks();