const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryHotels() {
    try {
        // En ucuz 5 oteli listele
        console.log('\nEn Ucuz 5 Otel:');
        console.log('-'.repeat(50));
        const cheapestHotels = await prisma.hotel.findMany({
            orderBy: {
                price: 'asc'
            },
            take: 5
        });
        
        cheapestHotels.forEach(hotel => {
            console.log(`${hotel.name} (${hotel.district})`);
            console.log(`Fiyat: ${hotel.price.toFixed(2)} TL`);
            console.log(`Kalan Oda: ${hotel.roomsLeft}`);
            console.log('-'.repeat(30));
        });
        
        // Semtlere göre otel ve oda sayıları
        console.log('\nSemtlere Göre İstatistikler:');
        console.log('-'.repeat(50));
        const districtStats = await prisma.hotel.groupBy({
            by: ['district'],
            _count: {
                id: true
            },
            _sum: {
                roomsLeft: true
            }
        });
        
        districtStats.forEach(stat => {
            console.log(`\nSemt: ${stat.district}`);
            console.log(`Otel Sayısı: ${stat._count.id}`);
            console.log(`Toplam Oda: ${stat._sum.roomsLeft}`);
        });
        
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

queryHotels(); 