import React from "react";
import {
  BaseButton,
  DatePicker,
  defaultDatePickerStrings,
  IButtonStyles,
  IconButton,
  IDatePicker,
  IOverflowSetItemProps,
  OverflowSet,
  Stack,
  TextField
} from "@fluentui/react";

export class DetailCard extends React.Component<{}, { selectedDate: Date }> {
  private datePickerRef: React.RefObject<IDatePicker>;
  constructor(props: any) {
    super(props);
    this.state = {
      selectedDate: new Date()
    };
    this.datePickerRef = React.createRef<IDatePicker>();
  }
  render() {
    const onRenderItem = (item: IOverflowSetItemProps): JSX.Element => {
      return (
          <BaseButton text={item.name}/>
      );
    }

    const onRenderOverflowButton = (overflowItems: any[] | undefined): JSX.Element => {
      const buttonStyles: Partial<IButtonStyles> = {
        root: {
          minWidth: 0,
          padding: '0 4px',
          alignSelf: 'stretch',
          height: 'auto',
        },
      };
      return (
          <IconButton
              role="menuitem"
              title="More options"
              styles={buttonStyles}
              menuIconProps={{iconName: 'More'}}
              menuProps={{items: overflowItems!}}
          />
      );
    };


    return <Stack className='DetailCard'>
      <Stack horizontalAlign='stretch' verticalAlign='center' horizontal
             className='CardRow1'>
        <span>Name:&nbsp;</span>
        <TextField value='Google Paycheck' className='TitleField'/>
        <span>Date:&nbsp;</span>
        <DatePicker
            componentRef={this.datePickerRef}
            className='DateField'
            // label="Start date"
            allowTextInput
            ariaLabel="Select a date"
            value={this.state.selectedDate}
            // onSelectDate={setValue as (date: Date | null | undefined) => void}
            // className={styles.control}
            // DatePicker uses English strings by default. For localized apps, you must override this prop.
            strings={defaultDatePickerStrings}
        />
      </Stack>
      <OverflowSet className="ItemTags" onRenderItem={onRenderItem}
                   onRenderOverflowButton={onRenderOverflowButton} items={
        [{key: "uri", name: "אורי"},
          {key: "uri1", name: 'גוגל',},
          {key: "uri2", name: 'משכורת'}]}/>

      <iframe className='BodyField' src='text.html'/>
    </Stack>;
  }
}
