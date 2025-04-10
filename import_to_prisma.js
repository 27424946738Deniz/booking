const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parse/sync');

const prisma = new PrismaClient();

async function importHotels() {
    try {
        // CSV dosyasını oku
        const fileContent = fs.readFileSync('hotel_analysis.csv', 'utf-8');
        
        // CSV'yi parse et
        const records = csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        console.log('Veriler veritabanına aktarılıyor...');
        
        // Her kayıt için veritabanına ekle
        for (const record of records) {
            await prisma.hotel.create({
                data: {
                    name: record.name,
                    district: record.district,
                    price: parseFloat(record.price),
                    roomsLeft: parseInt(record.rooms_left)
                }
            });
        }
        
        console.log('Veriler başarıyla aktarıldı!');
        
        // Toplam kayıt sayısını göster
        const count = await prisma.hotel.count();
        console.log(`Toplam ${count} otel kaydı oluşturuldu.`);
        
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

importHotels(); 