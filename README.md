# Messin' round with Typescript Parser Combinators

* parser-example.test.ts: some initial examples of building up parsers
* parsers.ts: Similar to parser-example, however, more closely a partial rewrite in Typescript of the Haskell based post [Parser Combinators Walkthrough](https://hasura.io/blog/parser-combinators-walkthrough/). The 'partial' bit is mostly in relation to showing ways of getting around the lack of do notation in Typescript.
* parser-usage-example.test.ts : playing around with parsers.ts

# REFERENCES

https://www.sigmacomputing.com/blog/writing-a-parser-combinator-from-scratch-in-typescript/
  The basic type structure follows that at the start of this article.

The following are about parser combinators in Haskell. If you are looking at Typescript, you might be afraid of Haskell. But these are very introductory and might offer some additional resources.

https://hasura.io/blog/parser-combinators-walkthrough/
  Working through a Haskell re-implementation of parsec. Mostly reimplemented in parsers.ts


http://dev.stephendiehl.com/fun/002_parsers.html




