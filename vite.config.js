// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'generate-grid',
      transformIndexHtml(html) {
        const size = 11;
        let gridHtml = '';
        
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            gridHtml += `
              <div class="cell" data-pos="${x},${y}">
                <div class="tpow"></div>
                <div class="ratio">
                  <div class="ratio_n"></div>
                  <div class="ratio_d"></div>
                </div>
              </div>`;
          }
        }
        // HTML内の <!--GRID_PLACEHOLDER--> を生成したHTMLに置換する
        return html.replace('<!--GRID_PLACEHOLDER-->', gridHtml);
      }
    }
  ]
});