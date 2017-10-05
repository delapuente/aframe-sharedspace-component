suite('SceneTree', () => {
  const SceneTree =
    require('../../../src/components/avatars/scene-tree').SceneTree;

  let sceneTree, root, el;

  setup(() => {
    root = document.createElement('DIV');
    el = document.createElement('DIV');
    el.id = 'test';
    root.appendChild(el);
    sinon.spy(el, 'setAttribute');
    sceneTree = new SceneTree(root);
  });

  test('Handles updates', () => {
    sceneTree.applyUpdates([
      {
        type: 'components',
        target: '#test',
        componentName: 'test-component',
        newValue: 'new-value'
      },
      {
        type: 'components',
        target: '#test',
        componentName: 'test-component-2',
        newValue: 'new-value'
      }
    ]);
    assert.isTrue(
      el.setAttribute.calledWith('test-component', 'new-value'));
    assert.isTrue(
      el.setAttribute.calledWith('test-component-2', 'new-value'));
  });

});
