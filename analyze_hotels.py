import json
import csv
from typing import Dict, Any, List
from dataclasses import dataclass
from decimal import Decimal
from collections import defaultdict

@dataclass
class HotelInfo:
    name: str
    district: str
    price: Decimal
    rooms_left: int

def get_district_from_address(hotel: Dict) -> str:
    """Adres bilgisinden semt bilgisini çıkarır."""
    try:
        if 'address' in hotel and isinstance(hotel['address'], dict):
            full_address = hotel['address'].get('full', '')
            if full_address:
                # Adresi virgülle ayır ve Istanbul'dan önceki kısmı al
                parts = full_address.split(',')
                for i, part in enumerate(parts):
                    if 'Istanbul' in part or 'İstanbul' in part:
                        if i > 0:
                            return parts[i-1].strip()
                        break
    except:
        pass
    return 'Bilinmiyor'

def get_min_price_from_options(options: List[Dict]) -> float:
    """Options listesinden en düşük fiyatı bulur."""
    min_price = float('inf')
    for option in options:
        price = option.get('displayedPrice', float('inf'))
        if isinstance(price, (int, float)) and price > 0:
            min_price = min(min_price, price)
    return min_price

def analyze_hotel_data(file_path: str) -> tuple[Dict[str, int], int, HotelInfo]:
    """
    Her otelin kalan oda sayısını hesaplar ve en ucuz odayı bulur.
    
    Returns:
        tuple: (otel_bazında_oda_sayıları, toplam_oda_sayısı, en_ucuz_oda_bilgisi)
    """
    hotel_rooms = defaultdict(int)  # Her otelin toplam oda sayısını tutacak
    cheapest_hotel = None
    min_price = float('inf')
    total_rooms = 0
    
    # Tüm otel bilgilerini tutacak liste
    all_hotels = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        hotels = json.load(f)
        print(f"\nToplam {len(hotels)} otel analiz ediliyor...")
        
        for hotel in hotels:
            try:
                hotel_name = hotel.get('name', 'Bilinmiyor')
                
                # Oda sayısını kontrol et
                rooms_left = None
                # Önce rooms içindeki roomsLeft'i kontrol et
                if 'rooms' in hotel and isinstance(hotel['rooms'], list):
                    for room in hotel['rooms']:
                        if 'roomsLeft' in room:
                            try:
                                room_count = int(room['roomsLeft'])
                                if room_count > 0:
                                    if rooms_left is None:
                                        rooms_left = 0
                                    rooms_left += room_count
                            except (ValueError, TypeError):
                                continue
                
                # Eğer rooms içinde bulunamadıysa, ana roomsLeft'i kontrol et
                if rooms_left is None:
                    rooms_left = hotel.get('roomsLeft', 0)
                    try:
                        rooms_left = int(rooms_left)
                    except (ValueError, TypeError):
                        rooms_left = 0
                
                if rooms_left > 0:
                    hotel_rooms[hotel_name] = rooms_left
                    total_rooms += rooms_left
                
                # Ana fiyat ve options fiyatlarını kontrol et
                base_price = hotel.get('price', float('inf'))
                if not isinstance(base_price, (int, float)):
                    base_price = float('inf')
                
                options_price = float('inf')
                if 'options' in hotel and isinstance(hotel['options'], list):
                    options_price = get_min_price_from_options(hotel['options'])
                
                # En düşük fiyatı seç
                price = min(base_price, options_price)
                
                if price != float('inf'):
                    district = get_district_from_address(hotel)
                    
                    # Her oteli listeye ekle
                    all_hotels.append({
                        'name': hotel_name,
                        'district': district,
                        'price': price,
                        'rooms_left': rooms_left
                    })
                    
                    if price < min_price:
                        min_price = price
                        cheapest_hotel = HotelInfo(
                            name=hotel_name,
                            district=district,
                            price=Decimal(str(price)),
                            rooms_left=rooms_left
                        )
            except (ValueError, AttributeError) as e:
                continue
    
    # Otelleri fiyata göre sırala
    all_hotels.sort(key=lambda x: (x['price'], x['name']))
    
    # CSV dosyasına kaydet
    with open('hotel_analysis.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['name', 'district', 'price', 'rooms_left'], quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(all_hotels)
    
    return hotel_rooms, total_rooms, cheapest_hotel

def main():
    file_path = 'dataset_booking-scraper_2025-03-24_00-07-02-694.json'
    hotel_rooms, total_rooms, cheapest_hotel = analyze_hotel_data(file_path)
    
    print("\nOtel Bazında Kalan Oda Sayıları:")
    print("-" * 40)
    for hotel_name, rooms in sorted(hotel_rooms.items()):
        print(f"{hotel_name}: {rooms} oda")
    
    print(f"\nToplam Oda Sayısı: {total_rooms}")
    
    if cheapest_hotel:
        print("\nEn Ucuz Otel Bilgileri:")
        print("-" * 40)
        print(f"Otel Adı: {cheapest_hotel.name}")
        print(f"Semt: {cheapest_hotel.district}")
        print(f"Fiyat: {cheapest_hotel.price:,.2f} TL")
        print(f"Kalan Oda Sayısı: {cheapest_hotel.rooms_left}")
    else:
        print("\nUygun otel bulunamadı.")
    
    print(f"\nTüm otel bilgileri 'hotel_analysis.csv' dosyasına kaydedildi.")

if __name__ == "__main__":
    main() 