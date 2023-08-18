import { describe, expect, test, beforeAll, afterEach } from '@jest/globals';
import { parse, GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLFieldResolver } from 'graphql';
import { subscribe } from 'graphql/subscription';
import { SolacePubSub } from '../solace-pubsub';
import { withFilter } from 'graphql-subscriptions';

const FIRST_EVENT = 'FIRST/EVENT';
let pubsub: SolacePubSub;

function buildSchema(iterator) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        testString: {
          type: GraphQLString,
          resolve: function (_, args) {
            return 'works';
          },
        },
      },
    }),
    subscription: new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        testSubscription: {
          type: GraphQLString,
          subscribe: withFilter(
            () => iterator,
            () => true
          ) as GraphQLFieldResolver<any, any, any>,
          resolve: (root) => {
            return 'FIRST/EVENT';
          },
        },
      },
    }),
  });
}

describe('PubSubAsyncIterator', () => {
  beforeAll(async () => {
    pubsub = await SolacePubSub.startWithDefaultOptions('GRAPHQL_QUEUE');
  });

  const query = parse(`
    subscription S1 {
      testSubscription
    }
  `);

  const patternQuery = parse(`
    subscription S1 {
      testSubscription
    }
  `);

  //Expects a local broker to be running websocket port on 8080

  test('should allow subscriptions', () => {
    const origIterator = pubsub.asyncIterator(FIRST_EVENT);
    const schema = buildSchema(origIterator);

    subscribe({ schema, document: query })
      .then((ai) => {
        const r = (ai as AsyncIterator<any>).next();
        expect(ai[Symbol.asyncIterator]).toBeDefined();
        setTimeout(() => pubsub.publish(FIRST_EVENT, {}), 50);
        return r;
      })
      .then((res) => {
        expect(res.value.data.testSubscription).toEqual(FIRST_EVENT);
        pubsub.stop();
      });
  });
});
