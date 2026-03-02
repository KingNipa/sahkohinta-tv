# sahkohinta-tv

Superyksinkertainen TV-nakyma sahkon hinnalle (snt/kWh), tehty ilman frameworkeja Samsung Smart TV -selainta varten.

## Tiedostot

- `index.html` - nakyman rakenne
- `style.css` - TV-ystavallinen ulkoasu
- `app.js` - datan haku, automaattinen paivitys, localStorage-valimuisti
- `mock-price.json` - paikallinen mock-data
- `icon.svg` - kuvake selaimen bookmark/shortcut-kayttoon

## Paikallinen ajo

1. Siirry projektikansioon:
   ```bash
   cd sahkohinta-tv
   ```
2. Kaynnista staattinen palvelin (esim. Python):
   ```bash
   python -m http.server 8080
   ```
3. Avaa selaimessa:
   ```
   http://localhost:8080/
   ```

## GitHub Pages -julkaisu (main branch, root)

1. Pushaa tiedostot `main`-haaraan.
2. Avaa GitHubissa: `Settings` -> `Pages`.
3. Valitse `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
4. Tallenna ja odota julkaisu valmis.
5. Sovellus loytyy osoitteesta:
   ```
   https://<username>.github.io/<repo>/
   ```

## Samsung Smart TV -kaytto

1. Avaa TV:n selaimella julkaistu GitHub Pages -osoite.
2. Lisaa sivu kirjanmerkiksi / aloitusnayton pikakuvakkeeksi selaimen valikosta.
3. Kuvakkeena kaytetaan tiedostoa `icon.svg`.

## Toiminta

- Hakee hinnan heti sivun latauksessa.
- Paivittaa automaattisesti 10 minuutin valein.
- Jos yhteys epaonnistuu, viimeisin onnistunut arvo pidetaan nakyvissa.
- Viimeisin onnistunut arvo tallennetaan `localStorage`en, joten arvo sailyy sivun uudelleenlatauksessa.
- `Paivitetty` nayttaa viimeisimman onnistuneen haun kellonajan (selaimen paikallinen aika).
- Mock-tiedoston `updatedAt` on staattinen esimerkkiaikaleima; siksi pelkka payloadin aika voi nayttaa vanhalta.
- Endpoint on konfiguroitavissa `app.js`-tiedoston alussa:
  ```js
  const CONFIG = { endpoint: "./mock-price.json", refreshMs: 600000 };
  ```
