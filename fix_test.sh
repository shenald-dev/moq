sed -i '/<<<<<<< HEAD/,/=======/d' tests/test.js
sed -i 's/>>>>>>> origin\/master//' tests/test.js
