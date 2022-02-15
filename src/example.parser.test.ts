
import { alt, any, bind, char, choice, Context, eof, failure, fmap, moveIndex, Parser, Result, satisfy, sequential2, sequential2b, sequential3, sequential4, success, tryParse } from "./parsers";

// 10 cups water
// 3grams tea


const isDigit = (c: char) => (c >= '0' && c <= '9');
const digitParser: Parser<number> = fmap(parseInt)(satisfy('not digit')(isDigit))


describe('test parsers', () => {
  test('', () => {
  })
})