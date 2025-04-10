const fs = require('fs').promises;
const path = require('path');

async function renameAndRestore() {
  try {
    // Tarih etiketi oluştur
    const date = new Date();
    const dateString = date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    
    // Yeni hotel_links.txt içeriğini oku
    const newContent = await fs.readFile('hotel_links.txt', 'utf8');
    
    // Tarih etiketi ile yeni bir dosya oluştur
    const newFileName = `hotel_links_${dateString}.txt`;
    await fs.writeFile(newFileName, newContent, 'utf8');
    console.log(`Yeni dosya oluşturuldu: ${newFileName}`);
    
    // Orijinal hotel_links.txt dosyasını geri yükle
    await fs.copyFile('hotel_links.txt.original', 'hotel_links.txt');
    console.log('Orijinal hotel_links.txt dosyası geri yüklendi');
    
    return true;
  } catch (error) {
    console.error('Hata:', error.message);
    return false;
  }
}

// Fonksiyonu çalıştır
renameAndRestore().then(success => {
  if (success) {
    console.log('İşlem başarıyla tamamlandı.');
  } else {
    console.log('İşlem sırasında hata oluştu.');
  }
}); 