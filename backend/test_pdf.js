import 'dotenv/config';
import { generateSignedPdf } from './src/services/pdf.ts';

async function testPdf() {
  try {
    const envelopeId = 'cmgq3x0ej0001ryncdwv9b4rq';
    console.log('Testing PDF generation for envelope:', envelopeId);
    
    const outputPath = await generateSignedPdf(envelopeId);
    console.log('PDF generated successfully at:', outputPath);
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testPdf();