import { GuestList } from '../../../../src/components/sharedspace/participation/guest-list';

suite('GuestList', () => {
  let list;

  setup(() => {
    list = new GuestList(1);
  });

  suite('add method', () => {
    test('does not add duplicates', () => {
      list.add('id1');
      list.add('id1');
      assert.equal(list.length, 1);
    });
  });

  suite('remove method', () => {
    test('nullify the participant without altering the list length', () => {
      list.add('id1');
      list.remove('id1');
      assert.equal(list.length, 1);
      assert.equal(list.indexOf('id1'), -1);
    });
  });

  suite('equals method', () => {
    let anotherList;

    setup(() => {
      anotherList = new GuestList(1);
      populateLists();
    });

    function populateLists () {
      ['id1', 'id2', 'id3'].forEach(id => {
        list.add(id);
        anotherList.add(id);
      });
    }

    test('return true if both lists contains the same items for the same timestamp', () => {
      assert.isTrue(list.equals(anotherList));
      assert.isTrue(anotherList.equals(list));
    });

    test('return false if both lists contains the same items but differ in timestamps', () => {
      anotherList = new GuestList(2);
      populateLists();
      assert.isFalse(list.equals(anotherList));
      assert.isFalse(anotherList.equals(list));
    });

    test('return false if the lists have different items regardless the timestamp', () => {
      anotherList.add('id4');
      assert.isFalse(list.equals(anotherList));
      assert.isFalse(anotherList.equals(list));
    });
  });

  suite('host method', () => {
    test('returns the first available participant', () => {
      list.add('id1');
      assert.equal(list.host(), 'id1');
    });

    test('returns the first available participant after removing another', () => {
      list.add('id1');
      list.add('id2');
      list.remove('id1');
      assert.equal(list.host(), 'id2');
    });

    test('returns undefined if no host', () => {
      assert.equal(list.host(), undefined);
    });
  });

  suite('nextHost method', () => {
    test('returns the host in the case of removing the current host', () => {
      list.add('id1');
      const next = list.nextHost();
      list.remove('id1');
      assert.equal(list.host(), next);
    });

    test('returns the host in the case of removing the current host (variant 2)', () => {
      list.add('id1');
      list.add('id2');
      const next = list.nextHost();
      list.remove('id1');
      assert.equal(list.host(), next);
    });
  });

  suite('isPresent method', () => {
    test('returns true or false whether a participant is in the list', () => {
      list.add('id1');
      assert.isTrue(list.isPresent('id1'));
      assert.isFalse(list.isPresent('id2'));
    });

    test('returns false after removing a participant', () => {
      list.add('id1');
      list.remove('id1');
      assert.isFalse(list.isPresent('id1'));
    });
  });

  suite('position', () => {
    test('returns the position in the list (1-based)', () => {
      list.add('id1');
      list.add('id2');
      assert.equal(list.position('id0'), 0);
      assert.equal(list.position('id1'), 1);
      assert.equal(list.position('id2'), 2);
    });
  });

  suite('indexOf method', () => {
    test('returns the position in the list (0-based)', () => {
      list.add('id1');
      list.add('id2');
      assert.equal(list.indexOf('id0'), -1);
      assert.equal(list.indexOf('id1'), 0);
      assert.equal(list.indexOf('id2'), 1);
    });
  });

  suite('getRole method', () => {
    test('returns `host` for the host participant', () => {
      list.add('id1');
      list.add('id2');
      const host = list.host();
      assert.equal(list.getRole(host), 'host');
    });

    test('returns `guest` for other participants', () => {
      list.add('id1');
      list.add('id2');
      assert.equal(list.getRole('id2'), 'guest');
    });

    test('returns `unknown` for participants not present', () => {
      list.add('id1');
      list.add('id2');
      assert.equal(list.getRole('id3'), 'unknown');
    });
  });

  suite('isHost method', () => {
    test('returns true if the guest is the host', () => {
      list.add('id1');
      list.add('id2');
      assert.isTrue(list.isHost('id1'));
    });

    test('returns false otherwise', () => {
      list.add('id1');
      list.add('id2');
      assert.isFalse(list.isHost('id2'));
      assert.isFalse(list.isHost('id3'));
    });
  });

  suite('clear method', () => {
    test('empties the list completely', () => {
      list.add('id1');
      list.add('id2');
      list.clear();
      assert.equal(list.length, 0);
    });
  });

  /*
   * XXX: Assumes the target list is contained up to the length of the former
   * one. So it computes removals of participants up to this point and
   * additions until the end of the target list.
   */
  suite('computeChanges method', () => {
    test('returns the empty set if the lists have the same items', () => {
      list.add('id1');
      assert.deepEqual(list.computeChanges(list), []);
    });

    test('returns the empty set if the lists have the same items (regardless the date)', () => {
      const anotherList = new GuestList(2);
      list.add('id1');
      anotherList.add('id1');
      assert.deepEqual(list.computeChanges(anotherList), []);
    });

    test('returns a participant enter for each extra element in target', () => {
      const anotherList = new GuestList(2);
      list.add('id1');
      anotherList.add('id1');
      anotherList.add('id2');
      anotherList.add('id3');
      assert.deepEqual(list.computeChanges(anotherList), [
        {
          id: 'id2',
          role: 'guest',
          position: 2,
          action: 'enter'
        },
        {
          id: 'id3',
          role: 'guest',
          position: 3,
          action: 'enter'
        }
      ]);
    });

    test('returns a participant exit for each null element in target', () => {
      const anotherList = new GuestList(2);
      list.add('id1');
      list.add('id2');
      list.add('id3');
      anotherList.add('id1');
      anotherList.add('id2');
      anotherList.add('id3');
      anotherList.remove('id1');
      anotherList.remove('id2');
      assert.deepEqual(list.computeChanges(anotherList), [
        {
          id: 'id1',
          role: 'host',
          position: 1,
          action: 'exit'
        },
        {
          id: 'id2',
          role: 'guest',
          position: 2,
          action: 'exit'
        }
      ]);
    });
  });

  suite('serialize static method', () => {
    test('converts the list into a plain JS object', () => {
      list.add('id1');
      list.add('id2');
      list.add('id3');
      list.remove('id2');
      assert.deepEqual(GuestList.serialize(list), {
        timestamp: 1,
        list: ['id1', null, 'id3']
      });
    });
  });

  suite('deserialize static method', () => {
    test('converts the plain JS object into a list', () => {
      list.add('id1');
      list.add('id2');
      list.add('id3');
      list.remove('id2');
      assert.isTrue(list.equals(GuestList.deserialize({
        timestamp: 1,
        list: ['id1', null, 'id3']
      })));
    });
  });

  suite('copy static method', () => {
    test('returns an identical copy of the list', () => {
      list.add('id1');
      const copy = GuestList.copy(list);
      assert.isTrue(list.equals(copy));
      assert.notEqual(copy, list);
    });
  });
});
