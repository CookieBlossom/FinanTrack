#main.py
import asyncio
from sites.banco_estado import BancoEstadoScraper, ScraperConfig

async def main():
    # Puedes personalizar la configuración aquí
    config = ScraperConfig(
        redis_host='localhost',
        redis_port=6379,
        results_dir="results",
        geolocation={
            "latitude": -33.4489,
            "longitude": -70.6693
        }
    )
    
    scraper = BancoEstadoScraper(config)
    await scraper.run()

if __name__ == "__main__":
    asyncio.run(main())