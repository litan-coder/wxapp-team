Component({
  properties: {
    entry: {
      type: Object,
      value: {}
    }
  },
  methods: {
    onEdit() {
      this.triggerEvent('edit', { entry: this.data.entry });
    },
    onDelete() {
      this.triggerEvent('delete', { id: this.data.entry.id });
    }
  }
});
