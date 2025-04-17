const express = require('express');
// Directly requiring these modules causes their top-level code to execute
// Use path.resolve to get the file paths without executing the code
const path = require('path');
const router = express.Router();

// Get file paths for later dynamic require
const scraperPath = path.resolve(__dirname, '../../scraper/run_room_scraper_specific.cjs');
const insertHotelsPath = path.resolve(__dirname, '../../scraper/insert-hotels');

/**
 * Run the scraper
 */
router.post('/scrape', (req, res) => {
  try {
    // Dynamically require the module only when needed
    const { runScraper } = require(scraperPath);
    
    // runScraper'ı çağır ama bitmesini bekleme (await yok)
    runScraper().catch(error => {
      // Arka planda bir hata olursa logla (isteğe yanıt zaten gönderildi)
      console.error('Scraper background error:', error);
    });

    // Scraper'ın başladığına dair hemen yanıt gönder
    res.status(202).json({ // 202 Accepted, isteğin kabul edildiğini ama işlemin devam ettiğini belirtir
      status: 'success',
      message: 'Scraper process started successfully.',
    });
  } catch (error) {
    // runScraper'ı başlatırken hemen bir hata olursa (require veya ilk çağrı anı)
    console.error('Error initiating scraper:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate scraper process',
      error: error.message
    });
  }
});

/**
 * Insert hotels from file
 */
router.post('/insert-hotels', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        status: 'error',
        message: 'File path is required'
      });
    }
    
    // Dynamically require the module only when needed
    const { insertHotelsFromFile } = require(insertHotelsPath);
    await insertHotelsFromFile(filePath);
    
    res.status(200).json({
      status: 'success',
      message: 'Hotels have been successfully inserted/updated in the database',
    });
  } catch (error) {
    console.error('Error inserting hotels:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to insert hotels',
      error: error.message
    });
  }
});

module.exports = router; 