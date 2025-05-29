import axios from 'axios';

const run = async () => {
  await axios.get('https://jsonplaceholder.typicode.com/posts/1');
};

run();
