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
router.post('/scrape', async (req, res) => {
  try {
    // Dynamically require the module only when needed
    const { runScraper } = require(scraperPath);
    const results = await runScraper();
    res.status(200).json({
      status: 'success',
      message: 'Scraper completed successfully',
    });
  } catch (error) {
    console.error('Error running scraper:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run the scraper',
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