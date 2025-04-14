import asyncio
import logging
from pathlib import Path
from prisma import Prisma
from prisma.errors import UniqueViolationError

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def clean_database(prisma: Prisma):
    """Deletes all data from Room, Availability, and Hotel tables."""
    try:
        logger.info('Cleaning database...')
        # Delete in reverse order of dependency
        await prisma.room.delete_many()
        logger.info('Deleted rooms')
        await prisma.availability.delete_many()
        logger.info('Deleted availabilities')
        await prisma.hotel.delete_many()
        logger.info('Deleted hotels')
        logger.info('Database cleaned successfully')
    except Exception as e:
        logger.error(f'Error cleaning database: {e}')
        raise # Re-throw the error to stop the import process

async def import_hotels(prisma: Prisma):
    """Imports hotel data from hotel_details.txt into the database."""
    hotels_processed = 0
    hotels_created = 0
    hotels_skipped = 0 # Counter for skipped duplicates


    logger.info('Starting hotel import...')

    # Clean the database first (optional, uncomment to enable)
    # await clean_database(prisma)

    file_path = Path.cwd() / 'hotel_details.txt'
    logger.info(f'Reading file from: {file_path}')

    if not file_path.exists():
        logger.error(f'Error: File not found at {file_path}')
        return # Exit the function gracefully

    current_hotel = {}
    line_count = 0

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if len(line) == 0:
                continue
            if line[0] == 'N':
                current_hotel['name'] = line[6:]
            elif line[0] == 'U':
                current_hotel['url'] = line[5:]
            elif line[0] == 'L':
                current_hotel['location'] = line[10:]
            elif line[0] == 'R':
                current_hotel['rating'] = line[8:]
            elif line[0] == '=':
                hotels_processed += 1
                if current_hotel.get('name') and current_hotel.get('url'):
                    rating_str = current_hotel.get('rating')
                    rating = None
                    if rating_str:
                        try:
                            rating = float(rating_str)
                        except ValueError:
                            logger.warning(f"Invalid rating format '{rating_str}' for hotel {current_hotel.get('name')}. Setting rating to null.")

                    hotel_data = {
                        'name': current_hotel['name'],
                        'url': current_hotel['url'],
                        'location': current_hotel.get('location'),
                        'rating': rating
                    }
                    
                    
                    try:
                        await prisma.hotel.create(data=hotel_data)
                        hotels_created += 1
                    except UniqueViolationError:
                        logger.warning(f"Skipping duplicate URL found in file: {hotel_data['url']} (Hotel: {hotel_data['name']})")
                        hotels_skipped += 1
    


async def main():
    """Main function to connect to DB, run import, and disconnect."""
    prisma = Prisma(log_queries=False) # Optionally log SQL queries
    """"""
    try:
        await prisma.connect()
        logger.info('Database connection established.')
        await import_hotels(prisma)
        #await clean_database(prisma)
    except Exception as e:
        logger.error(f"An error occurred in main execution: {e}")
    finally:
        if prisma.is_connected():
            await prisma.disconnect()
            logger.info('Database connection closed.')

if __name__ == '__main__':
    asyncio.run(main())
